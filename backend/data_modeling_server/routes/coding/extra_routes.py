import asyncio
import csv
import json
import os
import tempfile
from typing import Any, Dict, List
from fastapi import APIRouter, Body, Depends, HTTPException, Header, Request, BackgroundTasks
from fastapi.responses import FileResponse
import numpy as np
import pandas as pd

from config import Settings, CustomSettings
from constants import CODEBOOK_TYPE_MAP
from controllers.coding_controller import process_llm_task
from controllers.collection_controller import count_comments, get_reddit_post_by_id
from database import (
    SelectedPostIdsRepository,
    QectRepository, FunctionProgressRepository
)
from errors.request_errors import RequestError
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from models.coding_models import (
    RefineCodeRequest, 
    SamplePostsRequest, TranscriptRequest
)
from routes.websocket_routes import manager
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from utils.coding_helpers import generate_transcript
from database.db_helpers import execute_query, tuned_connection
from utils.prompts import  RefineSingleCode


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])
settings = Settings()

selected_post_ids_repo = SelectedPostIdsRepository()
qect_repo = QectRepository()
function_progress_repo = FunctionProgressRepository()

@router.post("/get-selected-post-ids")
async def get_selected_post_ids_endpoint(
    request: Request
):
    return selected_post_ids_repo.find({"workspace_id": request.headers.get("x-workspace-id")})



@router.post("/sample-posts")
async def sample_posts_endpoint(
    request: Request,
    request_body: SamplePostsRequest,
    workspace_id: str = Header(..., alias="x-workspace-id"),
):
    settings = CustomSettings()

    if request_body.sample_size <= 0 or not workspace_id or request_body.divisions < 1:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")

    sample_size = request_body.sample_size
    divisions = request_body.divisions

    print(f"Sampling posts for workspace {workspace_id} with sample size {sample_size} and divisions {divisions}")

    try:
        selected_post_ids_repo.update(
            {"workspace_id": workspace_id},
            {"type": "ungrouped"}
        )
    except Exception as e:
        print("Error resetting selections:", e)

    post_ids = [
        doc["post_id"]
        for doc in selected_post_ids_repo.find(
            {"workspace_id": workspace_id, "type": "ungrouped"},
            ["post_id"],
            map_to_model=False
        )
    ]
    print(f"Found {len(post_ids)} posts to sample")

    sem = asyncio.Semaphore(os.cpu_count())

    async def fetch_and_compute_length(pid: str):
        async with sem:
            try:
                post = await asyncio.to_thread(
                    get_reddit_post_by_id,
                    workspace_id, pid,
                    ["id", "title", "selftext"]
                )
                num_comments = count_comments(post.get("comments", []))
                first_item = await anext(generate_transcript(post))
                transcript = (
                    first_item["transcript"]
                    if isinstance(first_item, dict)
                    else first_item
                )
                return pid, len(transcript), num_comments
            except HTTPException as he:
                print(f"Post {pid} not found: {he.detail}")
                return pid, None, None
            except Exception as e:
                print(f"Error for post {pid}: {e}")
                return pid, None, None

    results = await asyncio.gather(*(fetch_and_compute_length(pid) for pid in post_ids))
    valid   = [r for r in results if r[1] is not None]
    invalid = [r[0] for r in results if r[1] is None]

    if invalid:
        print(f"Could not fetch posts: {invalid}")
    if not valid:
        raise HTTPException(status_code=400, detail="No valid posts found.")

    df = pd.DataFrame(valid, columns=["post_id", "length", "num_comments"])
   
    np.random.seed(settings.ai.randomSeed)
   
    raw_sample_size = sample_size
    N = len(df)
    if raw_sample_size < 1:
        total_samples = int(raw_sample_size * N)
    else:
        total_samples = int(raw_sample_size)
    total_samples = min(total_samples, N)
    print(f"Total samples: {total_samples}", "N:", N)
    if total_samples < 1:
        raise RequestError(
            status_code=400,
            message="Sample size too small given your data—no posts to return."
        )

    if divisions == 1:
        sampled = df.sample(n=total_samples, random_state=settings.ai.randomSeed)
        return {"sampled": sampled["post_id"].tolist()}

    if divisions == 2:
        group_sizes = [total_samples, N - total_samples]
    else:
        base = total_samples // divisions
        rem = total_samples % divisions
        group_sizes = [base + (1 if i < rem else 0) for i in range(divisions)]

    try:
        df["stratum"] = pd.qcut(
            df["length"],
            q=4,
            labels=False,
            duplicates="drop"
        )
    except ValueError as e:
        if "Bin edges must be unique" in str(e):
            shuffled = df.sample(n=total_samples, random_state=settings.ai.randomSeed).reset_index(drop=True)
            groups = []
            idx = 0
            for size in group_sizes:
                s = int(size)
                groups.append(shuffled.iloc[idx : idx + s]["post_id"].tolist())
                idx += s
        else:
            raise HTTPException(status_code=500, detail=f"Stratification error: {e}")
    else:
        remaining = df.copy()
        groups = []
        for size in group_sizes:
            if len(remaining) == 0:
                groups.append([])
                continue
            grp = remaining.groupby("stratum")
            counts = grp.size()
            proportion = float(size) / len(remaining)
            S_f = counts * proportion
            S = S_f.astype(int)
            leftover = int(size - int(S.sum()))
            if leftover > 0:
                fracs = S_f - S
                top_bins = fracs.nlargest(leftover).index
                for b in top_bins:
                    S.at[b] += 1

            sampled_ids = []
            for stratum, subset in grp:
                n = int(min(S.at[stratum], len(subset)))
                if n > 0:
                    sampled_ids += subset.sample(n=n, random_state=settings.ai.randomSeed)["post_id"].tolist()

            groups.append(sampled_ids)
            remaining = remaining[~remaining["post_id"].isin(sampled_ids)]

    if divisions == 2:
        names = ["sampled", "unseen"]
    else:
        names = [f"group_{i+1}" for i in range(divisions)]

    result = {names[i]: groups[i] for i in range(divisions)}

    for grp_name, pids in result.items():
        selected_post_ids_repo.bulk_update(
            [{"type": grp_name} for _ in pids],
            [{"workspace_id": workspace_id, "post_id": pid} for pid in pids],
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

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
    post_data = get_reddit_post_by_id(workspace_id, request_body.post_id)
    first_item = await anext(generate_transcript(post_data))
    transcript = (
        first_item["transcript"]
        if isinstance(first_item, dict)
        else first_item
    )

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

    return parsed_response

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
        r.code AS code,
        r.response_type,
        r.chat_history,
        r.range_marker,
        r.is_marked,
        r.source
    FROM qect r
    JOIN selected_post_ids p
      ON r.post_id    = p.post_id
     AND r.workspace_id = p.workspace_id
    LEFT JOIN grouped_code_entries g
      ON g.coding_context_id = r.workspace_id   
     AND g.code              = r.code        
    WHERE r.workspace_id = :workspace_id
      AND r.post_id      = :post_id
    """

    params: Dict[str, Any] = {
        "workspace_id": workspace_id,
        "post_id":     post_id,
    }

    if request_body.responseTypes:
        placeholders = ", ".join(f":rt{i}" for i in range(len(request_body.responseTypes)))
        resp_sql += f"\n  AND r.codebook_type IN ({placeholders})"
        for i, v in enumerate(request_body.responseTypes):
            params[f"rt{i}"] = CODEBOOK_TYPE_MAP.get(v, v)

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
            "chatHistory": json.loads(row["chat_history"]) if row["chat_history"] else None,
            "rangeMarker": json.loads(row["range_marker"]) if row["range_marker"] else None,
            "isMarked": bool(row["is_marked"]) if row["is_marked"] is not None else None,
            "source": json.loads(row["source"]) if row.get("source") else None,
        })

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
    
    response_types = list(map(lambda x: {"sampled": "initial", "unseen": "final"}[x], response_types))

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