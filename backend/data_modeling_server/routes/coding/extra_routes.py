import asyncio
import csv
import json
import os
import tempfile
import time
from typing import Any, Dict, List
from uuid import uuid4
from fastapi import APIRouter, Body, Depends, HTTPException, Header, Request, BackgroundTasks
from fastapi.responses import FileResponse
import numpy as np
import pandas as pd

from config import Settings, CustomSettings
from constants import STUDY_DATABASE_PATH
from controllers.coding_controller import filter_codes_by_transcript, insert_responses_into_db, process_llm_task, stream_selected_post_ids
from controllers.collection_controller import count_comments, get_reddit_post_by_id
from database import (
    ManualPostStatesRepository, SelectedPostIdsRepository,
    QectRepository, FunctionProgressRepository
)
from database.state_dump_table import StateDumpsRepository
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from ipc import send_ipc_message
from models.coding_models import (
    GenerateDeductiveCodesRequest,
    RefineCodeRequest, 
    SamplePostsRequest, TranscriptRequest
)
from models.table_dataclasses import (
    CodebookType, ManualPostState,
    StateDump
)
from routes.websocket_routes import manager
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from utils.coding_helpers import generate_transcript
from models import FunctionProgress
from database.db_helpers import execute_query, tuned_connection
from utils.prompts import GenerateDeductiveCodesFromCodebook, RefineSingleCode


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])
settings = Settings()

manual_post_state_repo = ManualPostStatesRepository()
selected_post_ids_repo = SelectedPostIdsRepository()
qect_repo = QectRepository()
function_progress_repo = FunctionProgressRepository()


state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

@router.post("/get-selected-post-ids")
async def get_selected_post_ids_endpoint(
    request: Request
):
    return selected_post_ids_repo.find({"workspace_id": request.headers.get("x-workspace-id")})



@router.post("/sample-posts")
async def sample_posts_endpoint(
    request: Request,
    request_body: SamplePostsRequest
):
    settings = CustomSettings()

    workspace_id = request.headers.get("x-workspace-id")

    if (request_body.sample_size <= 0 or 
        workspace_id == "" or 
        request_body.divisions < 1):
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    

    sample_size = request_body.sample_size
    divisions = request_body.divisions
    workspace_id = request.headers.get("x-workspace-id")

    start_time = time.time()


    try:
        selected_post_ids_repo.update({"workspace_id": workspace_id}, {"type": "ungrouped"})
    except Exception as e:
        print(e)
    
    post_ids = list(map(lambda x: x["post_id"], selected_post_ids_repo.find({"workspace_id": workspace_id, "type": "ungrouped"}, ["post_id"], map_to_model=False)))
    print(f"Post IDs: {len(post_ids)}")

    sem = asyncio.Semaphore(os.cpu_count())

    async def fetch_and_compute_length(post_id: str):
        async with sem:
            try:
                post = await asyncio.to_thread(get_reddit_post_by_id, workspace_id, post_id, [
                    "id", "title", "selftext"
                ])
                num_comments = count_comments(post.get("comments", []))
                transcript = await anext(generate_transcript(post))
                length = len(transcript)
                return post_id, length, num_comments
            except HTTPException as e:
                print(f"Post {post_id} not found: {e.detail}")
                return post_id, None, None
            except Exception as e:
                print(f"Unexpected error for post {post_id}: {e}")
                return post_id, None, None

    tasks = [fetch_and_compute_length(post_id) for post_id in post_ids]
    results = await asyncio.gather(*tasks)

    valid_results = [res for res in results if res[1] is not None]
    invalid_post_ids = [res[0] for res in results if res[1] is None]

    post_comments = {post_id: num_comments for post_id, _, num_comments in valid_results}

    if invalid_post_ids:
        print(f"Some posts were not found: {invalid_post_ids}")

    if not valid_results:
        raise HTTPException(status_code=400, detail="No valid posts found.")

    df = pd.DataFrame(valid_results, columns=['post_id', 'length', "num_comments"])
    np.random.seed(settings.ai.randomSeed)

    if divisions == 1:
        return {"sample": df['post_id'].tolist()}

    if divisions in [2, 3]:
        N = len(df)
        base_size = N // divisions
        remainder = N % divisions
        group_sizes = [base_size + 1 if i < remainder else base_size for i in range(divisions)]

        try:
            df['stratum'] = pd.qcut(df['length'], q=4, labels=False)
        except ValueError as e:
            if "Bin edges must be unique" in str(e):
                df = df.sample(frac=1, random_state=settings.ai.randomSeed).reset_index(drop=True)
                groups = []
                start = 0
                for size in group_sizes:
                    end = start + size
                    group_posts = df.iloc[start:end]['post_id'].tolist()
                    groups.append(group_posts)
                    start = end
            else:
                raise HTTPException(status_code=500, detail=f"Error in stratification: {e}")
        else:
            groups = []
            remaining_df = df.copy()
            for size in group_sizes:
                grouped = remaining_df.groupby('stratum')
                stratum_sizes = grouped.size()
                p = size / len(remaining_df) if len(remaining_df) > 0 else 0
                S_stratum_f = p * stratum_sizes
                S_stratum = S_stratum_f.astype(int)
                sum_S_stratum = S_stratum.sum()
                remainder_samples = size - sum_S_stratum
                if remainder_samples > 0:
                    fractional_parts = S_stratum_f - S_stratum
                    top_indices = fractional_parts.nlargest(remainder_samples).index
                    S_stratum.loc[top_indices] += 1

                sampled_post_ids = []
                for stratum, group in grouped:
                    n_samples = min(S_stratum[stratum], len(group))
                    if n_samples > 0:
                        sampled = group.sample(n=n_samples, random_state=settings.ai.randomSeed)
                        sampled_post_ids.extend(sampled['post_id'].tolist())

                groups.append(sampled_post_ids)
                remaining_df = remaining_df[~remaining_df['post_id'].isin(sampled_post_ids)]
    else:
        remaining_df = df.copy()
        groups = []
        for i in range(divisions - 1):
            try:
                remaining_df['stratum'] = pd.qcut(remaining_df['length'], q=4, labels=False)
            except ValueError as e:
                if "Bin edges must be unique" in str(e):
                    sampled = remaining_df.sample(frac=sample_size, random_state=settings.ai.randomSeed)
                else:
                    raise HTTPException(status_code=500, detail=f"Error in stratification: {e}")
            else:
                grouped = remaining_df.groupby('stratum')
                stratum_sizes = grouped.size()
                p = sample_size
                total_to_sample = min(int(p * len(remaining_df)), len(remaining_df))
                S_stratum_f = p * stratum_sizes
                S_stratum = S_stratum_f.astype(int)
                sum_S_stratum = S_stratum.sum()
                remainder = total_to_sample - sum_S_stratum
                if remainder > 0:
                    fractional_parts = S_stratum_f - S_stratum
                    top_indices = fractional_parts.nlargest(remainder).index
                    S_stratum.loc[top_indices] += 1

                sampled_post_ids = []
                for stratum, group in grouped:
                    n_samples = min(S_stratum[stratum], len(group))
                    if n_samples > 0:
                        sampled = group.sample(n=n_samples, random_state=settings.ai.randomSeed)
                        sampled_post_ids.extend(sampled['post_id'].tolist())
                sampled = remaining_df[remaining_df['post_id'].isin(sampled_post_ids)]

            groups.append(sampled['post_id'].tolist())
            remaining_df = remaining_df[~remaining_df['post_id'].isin(sampled['post_id'])]

        groups.append(remaining_df['post_id'].tolist())

    if divisions == 2:
        group_names = ["sampled", "unseen"]
    elif divisions == 3:
        group_names = ["sampled", "unseen", "manual"]
        manual_post_state_repo.insert_batch(
            list(map(lambda x: ManualPostState(
                workspace_id=workspace_id,
                post_id=x,
                is_marked=False,
            ), groups[-1]))
        )
    else:
        group_names = [f"group_{i+1}" for i in range(divisions)]

    result = {group_names[i]: groups[i] for i in range(divisions)}

    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "workspace_id": workspace_id,
                "sample_size": sample_size,
                "divisions": divisions,
                "groups": result,
                "post_comments": post_comments
            }),
            context=json.dumps({
                "function": "sample_posts",
                "workspace_id": workspace_id,
                "time_taken": time.time() - start_time,
            }),
        )
    )

    for group_name, post_ids in result.items():
        selected_post_ids_repo.bulk_update(
            [
                {"type": group_name} for _ in post_ids
            ],
            [{"workspace_id": workspace_id, "post_id": post_id} for post_id in post_ids],
        )
    return result



@router.post("/refine-code")
async def refine_single_code_endpoint(
    request: Request,
    request_body: RefineCodeRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id")
):
    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
    post_data = get_reddit_post_by_id(workspace_id, request_body.post_id)
    transcript =await anext(generate_transcript(post_data))

    *chat_history, user_comment = request_body.chat_history

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=request.headers.get("x-app-id"),
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=RefineSingleCode.refine_single_code_prompt,
        llm_instance=llm,
        parent_function_name="refine-single-code",
        llm_queue_manager=llm_queue_manager,
        transcript=transcript,
        code=request_body.code,
        quote=request_body.quote,
        chat_history=chat_history,
        user_comment=user_comment
    )


    state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "workspace_id": workspace_id,
                    "post_id": request_body.post_id,
                    "quote": request_body.quote,
                    "code": request_body.code,
                    "parsed_response": parsed_response,
                    "chat_history": request_body.chat_history,
                    "user_comment": user_comment,
                }),
                context=json.dumps({
                    "function": "refine_single_code",
                    "run":"initial",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )

    return parsed_response


@router.post("/generate-deductive-codes")
async def generate_deductive_codes_endpoint(
    request: Request,
    request_body: GenerateDeductiveCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    
    if qect_repo.count({"workspace_id": workspace_id, "codebook_type": CodebookType.MANUAL.value}) != 0:
        return {
            "message": "Deductive codes already exist for this dataset.",
            "data": []
        }

    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")

    start_time = time.time()

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    function_id = str(uuid4())
    total_posts = len(request_body.post_ids)

    function_progress_repo.insert(FunctionProgress(
        workspace_id=request.headers.get("x-workspace-id"),
        name="manual",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        async def process_post(post_id: str):
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Fetching data for post {post_id}...")
            
            post_data = get_reddit_post_by_id(workspace_id, post_id, [
                "id", "title", "selftext"
            ])

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generating transcript for post {post_id}...")
            transcripts = generate_transcript(post_data, llm.get_num_tokens)

            async for transcript in transcripts:
                parsed_response = await process_llm_task(
                    workspace_id=request.headers.get("x-workspace-id"),
                    app_id=app_id,
                    post_id=post_id,
                    manager=manager,
                    llm_model=request_body.model,
                    function_id=function_id,
                    regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                    prompt_builder_func=GenerateDeductiveCodesFromCodebook.generate_deductive_codes_from_codebook_prompt,
                    llm_instance=llm,
                    llm_queue_manager=llm_queue_manager,
                    parent_function_name="generate-deductive-codes",
                    codebook = request_body.codebook,
                    post_transcript=transcript,
                    store_response=True,
                    cacheable_args={
                        "args":[],
                        "kwargs": [
                            "codebook"
                        ]
                    }
                )

                if isinstance(parsed_response, list):
                    parsed_response = {"codes": parsed_response}

                codes = parsed_response.get("codes", [])
                for code in codes:
                    code["postId"] = post_id
                    code["id"] = str(uuid4())

                codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="generate-deductive-codes", post_id=post_id)
                codes = insert_responses_into_db(codes, workspace_id, request_body.model, CodebookType.MANUAL.value, parent_function_name="generate-deductive-codes", post_id=post_id)
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {post_id}...")
            return codes

        batches = stream_selected_post_ids(workspace_id, ["manual"]) 

        for batch in batches:
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing batch of {len(batch)} posts...")
            
            await asyncio.gather(*(process_post(post_id) for post_id in batch))

        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "workspace_id": workspace_id,
                    "codebook": qect_repo.find({"workspace_id": workspace_id, "codebook_type": CodebookType.MANUAL.value}, map_to_model=False),
                }),
                context=json.dumps({
                    "function": "generate_deductive_codes",
                    "run":"initial",
                    "workspace_id": request.headers.get("x-workspace-id"),
                    "time_taken": time.time() - start_time,
                }),
            )
        )
        await send_ipc_message(app_id, f"Dataset {workspace_id}: All posts processed successfully.")

        return {
            "message": "Deductive coding completed successfully!",
            "data": list(map(lambda x: {
                "id": x.id,
                "model": x.model,
                "quote": x.quote,
                "code": x.code,
                "type": x.response_type,
                "explanation": x.explanation,
                "postId": x.post_id,
                "chatHistory": json.loads(x.chat_history) if x.chat_history else None,
                "isMarked": bool(x.is_marked),
                "rangeMarker": json.loads(x.range_marker) if x.range_marker else None,
            } , qect_repo.find({"workspace_id": workspace_id, "codebook_type": CodebookType.MANUAL.value})))
        }
    except Exception as e:
        print(f"Error in manual_deductive_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during deductive coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})

@router.post("/transcript-data")
async def get_transcript_data_endpoint(
    request_body: TranscriptRequest,
    workspace_id: str = Header(..., alias="x-workspace-id"),
):
    post_id = request_body.postId
    print(post_id, "Got post id")
    post = get_reddit_post_by_id(workspace_id, post_id, [
        "id", "title", "selftext"
    ])

    resp_sql = """
    SELECT
        r.id,
        r.post_id,
        r.quote,
        r.explanation,
        CASE
        WHEN :manualCoding = 1 THEN COALESCE(g.higher_level_code, r.code)
        ELSE r.code
        END AS code,
        r.response_type,
        r.codebook_type,
        r.chat_history,
        r.range_marker,
        r.is_marked
    FROM qect r
    JOIN selected_post_ids p
        ON r.post_id    = p.post_id
    AND r.workspace_id = p.workspace_id
    LEFT JOIN grouped_code_entries g
        ON g.coding_context_id = r.workspace_id   
    AND g.code              = r.code        
    WHERE r.workspace_id = :workspace_id
        AND r.post_id    = :post_id;
    """

    params = {
        "manualCoding": 1 if request_body.manualCoding else 0,
        "workspace_id":   workspace_id,
        "post_id":      post_id,
    }
    resp_rows = execute_query(resp_sql, params, keys=True)

    responses: List[Dict[str, Any]] = []
    for row in resp_rows:
        responses.append({
            "id": row["id"],
            "postId": row["post_id"],
            "quote": row["quote"],
            "explanation": row["explanation"],
            "code": row["code"],
            "responseType": row["response_type"],
            "codebookType": row["codebook_type"],
            "chatHistory": json.loads(row["chat_history"]) if row["chat_history"] else None,
            "rangeMarker": json.loads(row["range_marker"]) if row["range_marker"] else None,
            "isMarked": bool(row["is_marked"]) if row["is_marked"] is not None else None,
        })

    if request_body.manualCoding:
        codes_sql = """
        SELECT DISTINCT
            g.higher_level_code AS code
        FROM grouped_code_entries g
        WHERE g.coding_context_id = ?
            AND g.higher_level_code IS NOT NULL
        ORDER BY g.higher_level_code;
        """
        code_rows = execute_query(codes_sql, [workspace_id], keys=True)
    else:
        codes_sql = """
        SELECT DISTINCT r.code
            FROM qect r
        WHERE r.workspace_id = ?
            AND r.code IS NOT NULL
        ORDER BY r.code;
        """
        code_rows = execute_query(codes_sql, [workspace_id], keys=True)
    all_codes = [r["code"] for r in code_rows if r["code"]]

    return {
        "post":      post,
        "responses": responses,
        "allCodes":  all_codes,
    }

@router.post("/download-codes")
async def download_qect_endpoint(
    background_tasks: BackgroundTasks,
    request_body: Any = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id")
):
    response_types = request_body.get('responseTypes', [])
    
    if not response_types:
        raise HTTPException(status_code=400, detail="responseTypes must be provided")
    
    response_types = list(map(lambda x: {"sampled": "initial", "unseen": "final", "manual": "manual"}[x], response_types))

    placeholders = ",".join("?" for _ in response_types)
    params = tuple([workspace_id, workspace_id, workspace_id, *response_types])
    sample_sql = f"""
    SELECT
      r.post_id AS "postId",
      r.code  AS "code",
      g.higher_level_code AS "reviewedCode",
      t.theme,
      r.quote,
      r.explanation
    FROM qect r
    LEFT JOIN grouped_code_entries g
      ON r.code = g.code
     AND g.coding_context_id = ?
    LEFT JOIN theme_entries t
      ON g.higher_level_code = t.higher_level_code
     AND t.coding_context_id = ?
    WHERE r.workspace_id = ? AND r.codebook_type IN ({placeholders})
    ORDER BY RANDOM()
    LIMIT 100
    """
    
    conn = tuned_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sample_sql, params)
        sample_rows = cursor.fetchall()
        
        if not sample_rows:
            raise HTTPException(status_code=404, detail="No data found for the given parameters")
        
        columns = [col[0] for col in cursor.description]
        
        non_empty_columns = set()
        for row in sample_rows:
            for i, value in enumerate(row):
                if value is not None:
                    non_empty_columns.add(columns[i])
        
        columns_to_include = list(non_empty_columns)
        if not columns_to_include:
            raise HTTPException(status_code=404, detail="All columns appear empty in the sample")
        
        include_indices = [i for i, col in enumerate(columns) if col in columns_to_include]
        
        main_sql = f"""
        SELECT
            r.post_id AS "postId",
            r.code  AS "code",
            g.higher_level_code AS "reviewedCode",
            t.theme,
            r.quote,
            r.explanation
        FROM qect r
        LEFT JOIN grouped_code_entries g
          ON r.code = g.code
         AND g.coding_context_id = ?
        LEFT JOIN theme_entries t
          ON g.higher_level_code = t.higher_level_code
         AND t.coding_context_id = ?
        WHERE r.workspace_id = ? AND r.codebook_type IN ({placeholders})
        ORDER BY r.id
        """
        
        cursor.execute(main_sql, params)
        
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="w", newline="", encoding="utf-8")
        writer = csv.writer(tmp)
        
        writer.writerow([columns[i] for i in include_indices])
        
        while True:
            batch = cursor.fetchmany(500)
            if not batch:
                break
            for row in batch:
                clean_row = ["" if row[i] is None else row[i] for i in include_indices]
                writer.writerow(clean_row)
        
        tmp.flush()
        tmp.close()

    finally:
        cursor.close()
        conn.close()

    background_tasks.add_task(os.remove, tmp.name)
    filename = "coding_responses.csv"
    return FileResponse(
        tmp.name,
        media_type="text/csv",
        filename=filename,
        background=background_tasks
    )