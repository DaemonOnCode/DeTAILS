import asyncio
import json
import time
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Header, Request

from constants import STUDY_DATABASE_PATH
from controllers.coding_controller import cluster_words_with_llm, filter_codes_by_transcript, filter_duplicate_codes_in_db, insert_responses_into_db, process_llm_task, stream_selected_post_ids, summarize_codebook_explanations
from controllers.collection_controller import get_reddit_post_by_id
from database import (
    FunctionProgressRepository, 
    QectRepository, 
    CodingContextRepository,
    SelectedPostIdsRepository,
    ResearchQuestionsRepository,
    ConceptEntriesRepository,
)
from database.state_dump_table import StateDumpsRepository
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from ipc import send_ipc_message
from models.coding_models import GenerateInitialCodesRequest, RedoInitialCodingRequest
from models.table_dataclasses import CodebookType, FunctionProgress, GenerationType, StateDump
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from utils.coding_helpers import generate_transcript
from routes.websocket_routes import manager
from utils.prompts import InitialCodePrompts, RemakerPrompts


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])


function_progress_repo = FunctionProgressRepository()
coding_context_repo = CodingContextRepository()
research_question_repo = ResearchQuestionsRepository()
concept_entries_repo = ConceptEntriesRepository()
selected_post_ids_repo = SelectedPostIdsRepository()
qect_repo = QectRepository()

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

@router.post("/generate-initial-codes")
async def generate_codes_endpoint(
    request: Request,
    request_body: GenerateInitialCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id"),
):
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Code generation process started.")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")

    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    concept_table = concept_entries_repo.find(
        {"coding_context_id": workspace_id, "is_marked": True},
        map_to_model=False
    )

    start_time = time.time()

    function_id = str(uuid4())
    total_posts = selected_post_ids_repo.count({"workspace_id": workspace_id, "type": "sampled"})
    if total_posts == 0:
        raise HTTPException(status_code=400, detail="No posts available for coding.")

    try:
        if function_progress_repo.find_one({"name": "initial", "workspace_id": workspace_id}):
            function_progress_repo.delete({"name": "initial", "workspace_id": workspace_id})
    except Exception as e:
        print(f"No row found: {e}")
        

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
        name="initial",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        try:
            qect_repo.delete({"workspace_id": workspace_id, "codebook_type": CodebookType.INITIAL.value})
        except Exception:
            pass

        async def process_post(post_id: str):
            try:
                await send_ipc_message(app_id, f"Dataset {workspace_id}: Fetching data for post {post_id}...")
                post_data = get_reddit_post_by_id(workspace_id, post_id, ["id", "title", "selftext"])
                await asyncio.sleep(0)

                await send_ipc_message(app_id, f"Dataset {workspace_id}: Generating transcript for post {post_id}...")
                transcripts_iter = generate_transcript(post_data, llm.get_num_tokens)

                all_codes = []
                async for item in transcripts_iter:
                    transcript = item["transcript"]
                    comment_map = item["comment_map"]
                    parsed_response = await process_llm_task(
                        workspace_id=workspace_id,
                        app_id=app_id,
                        post_id=post_id,
                        manager=manager,
                        llm_model=request_body.model,
                        regex_pattern=r"\"codes\":\s*(\[.*?\])",
                        parent_function_name="generate-initial-codes",
                        prompt_builder_func=InitialCodePrompts.initial_code_prompt,
                        function_id=function_id,
                        llm_instance=llm,
                        llm_queue_manager=llm_queue_manager,
                        main_topic=mainTopic,
                        additional_info=additionalInfo,
                        research_questions=researchQuestions,
                        concept_table=json.dumps(concept_table),
                        post_transcript=transcript,
                        store_response=True,
                        cacheable_args={
                            "args": [],
                            "kwargs": [
                                "main_topic",
                                "additional_info",
                                "research_questions",
                                "concept_table",
                            ]
                        }
                    )

                    if isinstance(parsed_response, list):
                        parsed_response = {"codes": parsed_response}

                    codes = parsed_response.get("codes", [])
                    for code in codes:
                        code["postId"] = post_id
                        code["id"] = str(uuid4())
                        src = code.get("source")
                        if isinstance(src, dict) and src.get("type") == "comment":
                            label   = src["comment_id"]
                            real_id = comment_map.get("comment "+label)
                            if real_id:
                                src["comment_id"] = real_id
                        if isinstance(src, dict):
                            src["post_id"] = post_id
                            code["source"] = json.dumps(src)

                    codes = filter_codes_by_transcript(
                        workspace_id,
                        codes,
                        transcript,
                        parent_function_name="generate-initial-codes",
                        post_id=post_id
                    )

                    inserted = insert_responses_into_db(
                        codes,
                        workspace_id,
                        request_body.model,
                        CodebookType.INITIAL.value,
                        parent_function_name="generate-initial-codes",
                        post_id=post_id
                    )
                    all_codes.extend(inserted)

                    progress = function_progress_repo.find_one({"function_id": function_id})
                    function_progress_repo.update(
                        {"function_id": function_id},
                        {"current": progress.current + 1}
                    )

                await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {post_id}...")
                return all_codes

            except Exception as e:
                await send_ipc_message(
                    app_id,
                    f"ERROR: Dataset {workspace_id}: Error processing post {post_id} - {str(e)}."
                )
                return []

        batches = stream_selected_post_ids(workspace_id, ["sampled"])
        for batch in batches:
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing batch of {len(batch)} posts...")
            await asyncio.gather(*(process_post(pid) for pid in batch))

        await send_ipc_message(app_id, f"Dataset {workspace_id}: All posts processed successfully.")

        unique_codes_query = """
            SELECT DISTINCT code
            FROM qect
            WHERE workspace_id = ? AND codebook_type = ?
        """
        unique_codes_result = qect_repo.execute_raw_query(
            unique_codes_query,
            (workspace_id, CodebookType.INITIAL.value),
            keys=True
        )
        unique_codes = [row["code"] for row in unique_codes_result]

        clusters = await cluster_words_with_llm(
            workspace_id,
            unique_codes,
            request_body.model,
            app_id,
            manager,
            llm,
            llm_queue_manager,
            parent_function_name="generate-initial-codes",
        )

        reverse_map = {}
        for head, subs in clusters.items():
            for sub in subs:
                reverse_map.setdefault(sub, head)

        for sub, head in reverse_map.items():
            qect_repo.execute_raw_query(
                """
                UPDATE qect
                SET code = ?
                WHERE code = ? AND workspace_id = ? AND codebook_type = ?
                """,
                (head, sub, workspace_id, CodebookType.INITIAL.value)
            )

        filter_duplicate_codes_in_db(
            workspace_id=workspace_id,
            codebook_type=CodebookType.INITIAL.value,
            generation_type=GenerationType.INITIAL.value,
            parent_function_name="generate-initial-codes",
            function_id=function_id
        )

        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "workspace_id": workspace_id,
                    "post_ids": [p["post_id"] for p in selected_post_ids_repo.find(
                        {"workspace_id": workspace_id, "type": "sampled"},
                        ["post_id"], map_to_model=False
                    )],
                    "results": qect_repo.find(
                        {"workspace_id": workspace_id, "codebook_type": CodebookType.INITIAL.value},
                        map_to_model=False
                    ),
                }),
                context=json.dumps({
                    "function": "initial_codes",
                    "run": "initial",
                    "function_id": function_id,
                    "workspace_id": workspace_id,
                    "time_taken": time.time() - start_time,
                }),
            )
        )

        function_progress_repo.update(
            {"function_id": function_id},
            {"status": "completed"}
        )

        return {"message": "Initial codes generated successfully!"}

    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during code generation.")
    finally:
        function_progress_repo.delete({"function_id": function_id})


@router.post("/redo-initial-coding")
async def generate_codes_endpoint(
    request: Request,
    request_body: RedoInitialCodingRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id"),
):
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Code generation process started.")

    start_time = time.time()


    function_id = str(uuid4())
    total_posts = selected_post_ids_repo.count({"workspace_id": workspace_id, "type": "sampled"})

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")
    
    mainTopic = coding_context.main_topic
    additionalInfo = coding_context.additional_info or ""
    researchQuestions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    concept_table = concept_entries_repo.find({"coding_context_id": workspace_id, "is_marked": True}, map_to_model=False)

    if function_progress_repo.find_one({"name": "initial", "workspace_id": workspace_id}, fail_silently=True):
        function_progress_repo.delete({"name": "initial", "workspace_id": workspace_id})

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
        name="initial",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)
        final_results = []
        function_id = str(uuid4())

        summarized_codebook_dict = await summarize_codebook_explanations(
            workspace_id = workspace_id,
            codebook_types = [CodebookType.INITIAL.value],
            llm_model = request_body.model,
            app_id = app_id,
            manager = manager,
            parent_function_name = "redo-initial-coding",
            llm_instance = llm,
            llm_queue_manager = llm_queue_manager,
            max_input_tokens = 128000,
            retries = 3,
            flush_threshold = 200,
            page_size = 500,
            concurrency_limit = 4,
            store_response = True
        )
        
        summarized_codebook = [{"code": code, "explanation": summary} 
                              for code, summary in summarized_codebook_dict.items()]

        try:
            qect_repo.delete({"workspace_id": workspace_id, "codebook_type": CodebookType.INITIAL.value})
        except Exception as e:
            print(e)

        async def process_post(post_id: str):
            try:
                await send_ipc_message(app_id, f"Dataset {workspace_id}: Fetching data for post {post_id}...")
                
                post_data = get_reddit_post_by_id(workspace_id, post_id, [
                    "id", "title", "selftext"
                ])

                await send_ipc_message(app_id, f"Dataset {workspace_id}: Generating transcript for post {post_id}...")
                transcripts_iter = generate_transcript(post_data, llm.get_num_tokens)
                async for item in transcripts_iter:
                    transcript = item["transcript"]
                    comment_map = item["comment_map"]
                    parsed_response = await process_llm_task(
                        workspace_id=workspace_id,
                        app_id=app_id,
                        post_id=post_id,
                        manager=manager,
                        llm_model=request_body.model,
                        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                        prompt_builder_func=RemakerPrompts.redo_initial_coding_prompt,
                        llm_instance=llm,
                        parent_function_name="redo-initial-coding",
                        llm_queue_manager=llm_queue_manager,
                        main_topic=mainTopic,
                        additional_info=additionalInfo,
                        research_questions=researchQuestions,
                        concept_table=json.dumps(concept_table),
                        function_id=function_id,
                        post_transcript=transcript,
                        current_codebook=json.dumps(summarized_codebook),
                        feedback = request_body.feedback,
                        store_response=True,
                        cacheable_args={
                            "args":[],
                            "kwargs": [
                                "main_topic",
                                "additional_info",
                                "research_questions",
                                "concept_table",
                                "current_codebook",
                                "feedback"
                            ]
                        }
                    )

                    if isinstance(parsed_response, list):
                        parsed_response = {"codes": parsed_response}

                    codes = parsed_response.get("codes", [])
                    for code in codes:
                        code["postId"] = post_id
                        code["id"] = str(uuid4())
                        src = code.get("source")
                        if isinstance(src, dict) and src.get("type") == "comment":
                            label   = src["comment_id"]
                            real_id = comment_map.get("comment "+label)
                            if real_id:
                                src["comment_id"] = real_id
                        if isinstance(src, dict):
                            src["post_id"] = post_id
                            code["source"] = json.dumps(src)

                    codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="redo-initial-coding", post_id=post_id, function_id=function_id)

                    codes = insert_responses_into_db(codes, workspace_id, request_body.model, CodebookType.INITIAL.value, parent_function_name="redo-initial-coding", post_id=post_id, function_id=function_id)

                await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {post_id}...")
                return codes

            except Exception as e:
                await send_ipc_message(app_id, f"ERROR: Dataset {workspace_id}: Error processing post {post_id} - {str(e)}.")
                return []


        batches = stream_selected_post_ids(workspace_id, ["sampled"])

        for batch in batches:
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing batch of {len(batch)} posts...")
            
            
            batch_results = await asyncio.gather(*(process_post(post_id) for post_id in batch))

            for codes in batch_results:
                final_results.extend(codes)

        await send_ipc_message(app_id, f"Dataset {workspace_id}: All posts processed successfully.")

        unique_codes_query = """
            SELECT DISTINCT code 
            FROM qect 
            WHERE workspace_id = ? AND codebook_type = ?
        """
        unique_codes_result = qect_repo.execute_raw_query(
            unique_codes_query,
            (workspace_id, CodebookType.INITIAL.value),
            keys=True
        )
        unique_codes = [row["code"] for row in unique_codes_result]

        res = await cluster_words_with_llm(
            workspace_id,
            unique_codes,
            request_body.model,
            app_id,
            manager,
            llm,
            llm_queue_manager,
            parent_function_name="redo-initial-coding",
        )

        print("Clustered words with LLM", res)

        reverse_map_one_to_one = {}

        
        for topic_head, subtopics in res.items():
            for subtopic in subtopics:
                
                if subtopic not in reverse_map_one_to_one:
                    reverse_map_one_to_one[subtopic] = topic_head
        
        for subtopic, topic_head in reverse_map_one_to_one.items():
            update_query = """
                UPDATE qect 
                SET code = ? 
                WHERE code = ? AND workspace_id = ? AND codebook_type = ?
            """
            qect_repo.execute_raw_query(
                update_query,
                (topic_head, subtopic, workspace_id, CodebookType.INITIAL.value)
            )

        for row in final_results:
            row["code"] = reverse_map_one_to_one.get(row["code"], row["code"])

        filter_duplicate_codes_in_db(
            workspace_id=workspace_id,
            codebook_type=CodebookType.INITIAL.value,
            generation_type=GenerationType.LATEST.value,
            parent_function_name="redo-initial-coding",
            function_id=function_id
        )
        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "workspace_id": workspace_id,
                    "post_ids": list(map(lambda x: x["post_id"],selected_post_ids_repo.find({"workspace_id": workspace_id, "type": "sampled"}, ["post_id"], map_to_model=False))),
                    "results": final_results,
                    "feedback": request_body.feedback
                }),
                context=json.dumps({
                    "function": "initial_codes",
                    "run":"regenerate",
                    "function_id": function_id,
                    "workspace_id": workspace_id,
                    "time_taken": time.time() - start_time,
                }),
            )
        )

        function_progress_repo.update({
            "function_id": function_id,
        }, {
            "status": "completed",
        })

        return {
            "message": "Initial codes generated successfully!",
            "data": final_results
        }
    except Exception as e:
        print(f"Error in generate_codes_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during code generation.")
    finally:
        function_progress_repo.delete({"function_id": function_id})
