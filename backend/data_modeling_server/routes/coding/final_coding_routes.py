import asyncio
from datetime import datetime
import json
import time
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request

from constants import STUDY_DATABASE_PATH
from controllers.coding_controller import filter_codes_by_transcript, filter_duplicate_codes_in_db,insert_responses_into_db, process_llm_task, stream_qect_pages, stream_selected_post_ids, summarize_codebook_explanations
from controllers.collection_controller import get_reddit_post_by_id
from database import (
    FunctionProgressRepository, 
    QectRepository, 
    CodingContextRepository,
    SelectedPostIdsRepository,
    ResearchQuestionsRepository,
    ConceptEntriesRepository,
    InitialCodebookEntriesRepository
)
from database.state_dump_table import StateDumpsRepository
from errors.request_errors import RequestError
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from ipc import send_ipc_message
from models.coding_models import GenerateFinalCodesRequest, RedoFinalCodingRequest
from models.table_dataclasses import CodebookType, FunctionProgress, GenerationType, QectResponse, StateDump
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from utils.coding_helpers import generate_transcript
from routes.websocket_routes import manager
from utils.prompts import FinalCoding, RemakerPrompts


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])


function_progress_repo = FunctionProgressRepository()
coding_context_repo = CodingContextRepository()
research_question_repo = ResearchQuestionsRepository()
concept_entries_repo = ConceptEntriesRepository()
selected_post_ids_repo = SelectedPostIdsRepository()
qect_repo = QectRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)



@router.post("/generate-final-codes")
async def final_coding_endpoint(
    request: Request,
    request_body: GenerateFinalCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    workspace_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Final coding process started.")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")
    
    if qect_repo.count({"workspace_id": workspace_id, "codebook_type": [CodebookType.INITIAL.value], "is_marked": True}) == 0:
        raise RequestError(status_code=400, message="No responses available.")


    final_codebook = initial_codebook_repo.find_one({"coding_context_id": workspace_id}, map_to_model=False)
    main_topic = coding_context.main_topic
    additional_info = coding_context.additional_info or ""
    research_questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    concept_table = concept_entries_repo.find({"coding_context_id": workspace_id, "is_marked": True}, map_to_model=False)

    start_time = time.time()

    function_id = str(uuid4())
    total_posts = selected_post_ids_repo.count({"workspace_id": workspace_id, "type": "unseen"})

    try:
        print(function_progress_repo.find())
        if function_progress_repo.find_one({"name": "final"}):
            function_progress_repo.delete({"name": "final"})
    except Exception as e:
        print(f"Error in final_coding_endpoint: {e}")

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
        name="final",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        try:
            qect_repo.delete({"workspace_id": workspace_id, "codebook_type": CodebookType.FINAL.value})
        except Exception as e:
            print(e)

        async def process_post(post_id: str):
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Fetching data for post {post_id}...")
            
            print("Post data fetching")
            post_data = get_reddit_post_by_id(workspace_id, post_id, [
                "id", "title", "selftext"
            ])
            print("Post data fetched")

            await asyncio.sleep(0)

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generating transcript for post {post_id}...")
            transcripts = generate_transcript(
                post_data,
                token_checker=llm.get_num_tokens
            )
            async for transcript in transcripts:
                print("Chunk yielded")
                parsed_response = await process_llm_task(
                    workspace_id=workspace_id,
                    app_id=app_id,
                    post_id=post_id,
                    manager=manager,
                    llm_model=request_body.model,
                    regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                    prompt_builder_func=FinalCoding.final_coding_prompt,
                    llm_instance=llm,
                    parent_function_name="final-coding",
                    function_id=function_id,
                    llm_queue_manager=llm_queue_manager,
                    final_codebook=json.dumps(final_codebook, indent=2),
                    concept_table=json.dumps(concept_table, indent=2),
                    main_topic=main_topic,
                    additional_info=additional_info,
                    research_questions=json.dumps(research_questions),
                    post_transcript=transcript,
                    store_response=True,
                    cacheable_args={
                        "args":[],
                        "kwargs": [
                            "main_topic",
                            "additional_info",
                            "research_questions",
                            "concept_table",
                            "final_codebook"
                        ]
                    }
                )

                if isinstance(parsed_response, list):
                    parsed_response = {"codes": parsed_response}

                codes = parsed_response.get("codes", [])
                for code in codes:
                    code["postId"] = post_id
                    code["id"] = str(uuid4())

                codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="final-coding", post_id=post_id, function_id=function_id)
                function_progress_repo.update({
                        "function_id": function_id,
                    }, {
                        "current": function_progress_repo.find_one({
                            "function_id": function_id
                        }).current + 1
                    })

                codes = insert_responses_into_db(codes, workspace_id, request_body.model, CodebookType.FINAL.value, parent_function_name="final-coding", post_id=post_id, function_id=function_id)

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {post_id}...")
            return codes

        batches = stream_selected_post_ids(workspace_id, ["unseen"])

        for batch in batches:
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing batch of {len(batch)} posts...")
            
            await asyncio.gather(*(process_post(post_id) for post_id in batch))
            
        await send_ipc_message(app_id, f"Dataset {workspace_id}: All posts processed successfully.")

        async for batch in stream_qect_pages(
            workspace_id=workspace_id,
            codebook_types=[CodebookType.INITIAL.value],
        ):
            for row in batch:
                row["id"] = str(uuid4())
                row["codebook_type"] = CodebookType.INITIAL_COPY.value
                row["created_at"] = datetime.now()

            qect_repo.insert_batch(list(map(lambda x: QectResponse(**x), batch)))


        filter_duplicate_codes_in_db(
            workspace_id=workspace_id,
            codebook_type=CodebookType.FINAL.value,
            generation_type=GenerationType.INITIAL.value,
            parent_function_name="final-coding", 
            function_id=function_id
        )


        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "workspace_id": workspace_id,
                    "post_ids": selected_post_ids_repo.find({"workspace_id": workspace_id, "type": "unseen"}, ["post_id"], map_to_model=False),
                    "results": qect_repo.find({"workspace_id": workspace_id, "codebook_type": CodebookType.FINAL.value}, map_to_model=False),
                }),
                context=json.dumps({
                    "function": "final_codes",
                    "run":"initial",
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
            "message": "Final coding completed successfully!",
        }
    except Exception as e:
        print(f"Error in final_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during final coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})


@router.post("/remake-final-codes")
async def redo_final_coding_endpoint(
    request: Request,
    request_body: RedoFinalCodingRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    workspace_id = request.headers.get("x-workspace-id")
    app_id = request.headers.get("x-app-id")
    workspace_id = request.headers.get("x-workspace-id")
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Final coding process started.")

    coding_context = coding_context_repo.find_one({"id": workspace_id})
    if not coding_context:
        raise HTTPException(status_code=404, detail="Coding context not found for the workspace.")
    
    if qect_repo.count({"workspace_id": workspace_id, "codebook_type": [CodebookType.INITIAL.value], "is_marked": True}) == 0:
        raise RequestError(status_code=400, message="No responses available.")

    final_codebook = initial_codebook_repo.find_one({"coding_context_id": workspace_id}, map_to_model=False)
    main_topic = coding_context.main_topic
    additional_info = coding_context.additional_info or ""
    research_questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
    concept_table = concept_entries_repo.find({"coding_context_id": workspace_id, "is_marked": True}, map_to_model=False)

    start_time = time.time()

    function_id = str(uuid4())
    total_posts = selected_post_ids_repo.count({"workspace_id": workspace_id, "type": "unseen"})

    function_progress_repo.insert(FunctionProgress(
        workspace_id=workspace_id,
        name="final",
        function_id=function_id,
        status="started",
        current=0,
        total=total_posts
    ))

    try:
        llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

        summarized_current_codebook_dict = await summarize_codebook_explanations(
            workspace_id = workspace_id,
            codebook_types = [CodebookType.INITIAL_COPY.value, CodebookType.FINAL.value],
            llm_model = request_body.model,
            app_id = app_id,
            manager = manager,
            parent_function_name = "redo-final-coding",
            llm_instance = llm,
            llm_queue_manager = llm_queue_manager,
            max_input_tokens = 128000,
            retries = 3,
            flush_threshold = 200,
            page_size = 500,
            concurrency_limit = 4,
            store_response = True
        )
        summarized_current_codebook = [{"code": code, "explanation": summary} 
                                      for code, summary in summarized_current_codebook_dict.items()]
        
        try:
            qect_repo.delete({"workspace_id": workspace_id, "codebook_type": CodebookType.FINAL.value})
        except Exception as e:
            print(e)

        async def process_post(post_id: str):
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Fetching data for post {post_id}...")
            
            post_data = get_reddit_post_by_id(workspace_id, post_id, [
                "id", "title", "selftext"
            ])

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generating transcript for post {post_id}...")
            transcripts = generate_transcript(post_data, llm.get_num_tokens)

            async for transcript in transcripts:
                parsed_response = await process_llm_task(
                    workspace_id=workspace_id,
                    app_id=app_id,
                    post_id=post_id,
                    manager=manager,
                    function_id=function_id,
                    llm_model=request_body.model,
                    regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                    prompt_builder_func=RemakerPrompts.redo_final_coding_prompt,
                    llm_instance=llm,
                    parent_function_name="redo-final-coding",
                    llm_queue_manager=llm_queue_manager,
                    final_codebook=json.dumps(final_codebook, indent=2),
                    concept_table=json.dumps(concept_table, indent=2),
                    main_topic=main_topic,
                    additional_info=additional_info,
                    research_questions=json.dumps(research_questions),
                    post_transcript=transcript,
                    current_codebook=json.dumps(summarized_current_codebook),
                    feedback = request_body.feedback,
                    store_response=True,
                    cacheable_args={
                        "args":[],
                        "kwargs": [
                            "main_topic",
                            "additional_info",
                            "research_questions",
                            "concept_table",
                            "final_codebook",
                            "current_codebook"
                        ]
                    }
                )

                
                if isinstance(parsed_response, list):
                    parsed_response = {"codes": parsed_response}

                codes = parsed_response.get("codes", [])
                for code in codes:
                    code["postId"] = post_id
                    code["id"] = str(uuid4())

                codes = filter_codes_by_transcript(workspace_id, codes, transcript, parent_function_name="redo-final-coding", post_id=post_id, function_id=function_id)

                codes = insert_responses_into_db(codes, workspace_id, request_body.model, CodebookType.FINAL.value, parent_function_name="redo-final-coding", post_id=post_id, function_id=function_id)
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {post_id}...")
            return codes

        batches = stream_selected_post_ids(workspace_id, ["unseen"])

        for batch in batches:
            await send_ipc_message(app_id, f"Dataset {workspace_id}: Processing batch of {len(batch)} posts...")
            
            await asyncio.gather(*(process_post(post_id) for post_id in batch))


        await send_ipc_message(app_id, f"Dataset {workspace_id}: All posts processed successfully.")

        filter_duplicate_codes_in_db(
            workspace_id=workspace_id,
            codebook_type=CodebookType.FINAL.value,
            generation_type=GenerationType.LATEST.value,
            parent_function_name="redo-final-coding", 
            function_id=function_id
        )

        state_dump_repo.insert(
            StateDump(
                state=json.dumps({
                    "workspace_id": workspace_id,
                    "post_ids": selected_post_ids_repo.find({"workspace_id": workspace_id, "type": "unseen"}, ["post_id"], map_to_model=False),
                    "results": qect_repo.find({"workspace_id": workspace_id, "codebook_type": CodebookType.FINAL.value}, map_to_model=False),
                    "feedback": request_body.feedback
                }),
                context=json.dumps({
                    "function": "final_codes",
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
            "message": "Final coding completed successfully!"
        }
    except Exception as e:
        print(f"Error in redo_final_coding_endpoint: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during final coding.")
    finally:
        function_progress_repo.delete({"function_id": function_id})

