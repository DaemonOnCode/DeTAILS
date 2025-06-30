import asyncio
import json
import time
from typing import Any, Dict, List
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Header, Request

from constants import STUDY_DATABASE_PATH
from controllers.coding_controller import cluster_words_with_llm, filter_codes_by_transcript, filter_duplicate_codes_in_db, insert_responses_into_db, process_llm_task, run_coding_flow, stream_selected_post_ids, summarize_codebook_explanations
from controllers.collection_controller import get_interview_data_by_id, get_reddit_post_by_id
from database import (
    FunctionProgressRepository, 
    QectRepository, 
    CodingContextRepository,
    SelectedPostIdsRepository,
    ResearchQuestionsRepository,
    ConceptEntriesRepository,
    CollectionContextRepository
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
from utils.prompts import InitialCodePrompts, InterviewInitialPrompts, InterviewRemakerPrompts, RemakerPrompts


router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])


function_progress_repo = FunctionProgressRepository()
coding_context_repo = CodingContextRepository()
research_question_repo = ResearchQuestionsRepository()
concept_entries_repo = ConceptEntriesRepository()
selected_post_ids_repo = SelectedPostIdsRepository()
collection_context_repo = CollectionContextRepository()
qect_repo = QectRepository()

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)


@router.post("/generate-initial-codes")
async def generate_initial_codes(
    request: Request,
    body: GenerateInitialCodesRequest,
    llm_queue_manager=Depends(get_llm_manager),
    llm_service=Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id")
):
    function_id = str(uuid4())

    
    # reset any prior progress
    try:
        if function_progress_repo.find_one({"name": "initial", "workspace_id": workspace_id}, map_to_model=False):
            function_progress_repo.delete({"name": "initial", "workspace_id": workspace_id})
    except Exception as e:
        print(f"Error resetting prior function progress for initial: {e}")

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Initial coding started.")
    coding_ctx = coding_context_repo.find_one({"id": workspace_id}) or HTTPException(404, "Coding context not found.")
    coll_ctx   = collection_context_repo.find_one({"id": workspace_id}) or HTTPException(404, "Collection context not found.")

    if coll_ctx.type == "interview":
        main = coding_ctx.main_topic
        extra = coding_ctx.additional_info or ""
        questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]

        async def process_interview(pid: str):
            turns = get_interview_data_by_id(pid)
            async for chunk in generate_transcript({"turns": turns}, llm_service.get_llm_and_embeddings(body.model)[0].get_num_tokens):
                for q in questions:
                    parsed = await process_llm_task(
                        workspace_id=workspace_id,
                        app_id=app_id,
                        manager=llm_queue_manager,
                        llm_model=body.model,
                        regex_pattern=r"\"codes\":\s*(\[.*?\])",
                        parent_function_name="generate-initial-codes",
                        prompt_builder_func=InterviewInitialPrompts.initial_interview_prompt,
                        function_id=function_id,
                        llm_instance=llm_service.get_llm_and_embeddings(body.model)[0],
                        llm_queue_manager=llm_queue_manager,
                        main_topic=main,
                        additional_info=extra,
                        research_question=q,
                        post_transcript=chunk["transcript"],
                        store_response=True,
                        cacheable_args={"args": [], "kwargs": ["main_topic","additional_info","research_question"]}
                    )
                    codes = parsed if isinstance(parsed, list) else parsed.get("codes", [])
                    for c in codes:
                        c.update(id=str(uuid4()), postId=pid)
                        src = c.get("source", {})
                        if isinstance(src, dict):
                            src.update(post_id=pid, rq=q)
                            c["source"] = json.dumps(src)
                    filtered = filter_codes_by_transcript(workspace_id, codes, chunk["transcript"], "generate-initial-codes", pid)
                    insert_responses_into_db(filtered, workspace_id, body.model, CodebookType.INITIAL.value, "generate-initial-codes", pid)

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {pid}...")
            prog = function_progress_repo.find_one({"function_id": function_id})
            function_progress_repo.update(
                {"function_id": function_id},
                {"current": prog.current + 1}
            )


        get_batches = lambda: stream_selected_post_ids(workspace_id, ["sampled"])
        return await run_coding_flow(
            function_id=function_id,
            workspace_id=workspace_id,
            app_id=app_id,
            model=body.model,
            llm_queue_manager=llm_queue_manager,
            llm_service=llm_service,
            name="initial",
            codebook_type=CodebookType.INITIAL,
            generation_type=GenerationType.INITIAL,
            post_id_type="sampled",
            get_batches=get_batches,
            process_item=process_interview
        )

    elif coll_ctx.type == "reddit":
        main = coding_ctx.main_topic
        extra = coding_ctx.additional_info or ""
        questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
        concept_table = concept_entries_repo.find({"coding_context_id": workspace_id, "is_marked": True}, map_to_model=False)

        async def process_reddit(pid: str):
            post = get_reddit_post_by_id(workspace_id, pid, ["id","title","selftext"])
            async for chunk in generate_transcript(post, llm_service.get_llm_and_embeddings(body.model)[0].get_num_tokens):
                parsed = await process_llm_task(
                    workspace_id=workspace_id,
                    app_id=app_id,
                    post_id=pid,
                    manager=llm_queue_manager,
                    llm_model=body.model,
                    regex_pattern=r"\"codes\":\s*(\[.*?\])",
                    parent_function_name="generate-initial-codes",
                    prompt_builder_func=InitialCodePrompts.initial_code_prompt,
                    function_id=function_id,
                    llm_instance=llm_service.get_llm_and_embeddings(body.model)[0],
                    llm_queue_manager=llm_queue_manager,
                    main_topic=main,
                    additional_info=extra,
                    research_questions=questions,
                    concept_table=json.dumps(concept_table),
                    post_transcript=chunk["transcript"],
                    store_response=True,
                    cacheable_args={"args":[],"kwargs":["main_topic","additional_info","research_questions","concept_table"]}
                )
                codes = parsed if isinstance(parsed, list) else parsed.get("codes", [])
                for c in codes:
                    c.update(id=str(uuid4()), postId=pid)
                    src = c.get("source", {})
                    if isinstance(src, dict) and src.get("type") == "comment":
                        real = chunk["comment_map"].get(f"comment {src['comment_id']}")
                        if real: src["comment_id"] = real
                    if isinstance(src, dict):
                        src.update(post_id=pid)
                        c["source"] = json.dumps(src)
                filtered = filter_codes_by_transcript(workspace_id, codes, chunk["transcript"], "generate-initial-codes", pid)
                insert_responses_into_db(filtered, workspace_id, body.model, CodebookType.INITIAL.value, "generate-initial-codes", pid)

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {pid}...")
            prog = function_progress_repo.find_one({"function_id": function_id})
            function_progress_repo.update(
                {"function_id": function_id},
                {"current": prog.current + 1}
            )


        get_batches = lambda: stream_selected_post_ids(workspace_id, ["sampled"])
        return await run_coding_flow(
            function_id=function_id,
            workspace_id=workspace_id,
            app_id=app_id,
            model=body.model,
            llm_queue_manager=llm_queue_manager,
            llm_service=llm_service,
            name="initial",
            codebook_type=CodebookType.INITIAL,
            generation_type=GenerationType.INITIAL,
            post_id_type="sampled",
            get_batches=get_batches,
            process_item=process_reddit
        )

    else:
        raise HTTPException(status_code=400, detail="Unsupported collection type.")


@router.post("/redo-initial-coding")
async def redo_initial_coding(
    request: Request,
    body: RedoInitialCodingRequest,
    llm_queue_manager=Depends(get_llm_manager),
    llm_service=Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id")
):
    function_id = str(uuid4())

    # reset any prior progress
    try:
        if function_progress_repo.find_one({"name": "initial", "workspace_id": workspace_id}, map_to_model=False):
            function_progress_repo.delete({"name": "initial", "workspace_id": workspace_id})
    except Exception as e:
        print(f"Error resetting prior function progress for initial: {e}")


    await send_ipc_message(app_id, f"Dataset {workspace_id}: Redo initial coding started.")
    coll_ctx = collection_context_repo.find_one({"id": workspace_id}) or HTTPException(404, "Collection context not found.")
    coding_ctx = coding_context_repo.find_one({"id": workspace_id}) or HTTPException(404, "Coding context not found.")

    summary_args = dict(
        workspace_id=workspace_id,
        codebook_types=[CodebookType.INITIAL.value],
        llm_model=body.model,
        app_id=app_id,
        manager=llm_queue_manager,
        parent_function_name="redo-initial-coding",
        llm_instance=llm_service.get_llm_and_embeddings(body.model)[0],
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000,
        retries=3,
        flush_threshold=200,
        page_size=500,
        concurrency_limit=4,
        store_response=True
    )

    if coll_ctx.type == "interview":
        main = coding_ctx.main_topic
        extra = coding_ctx.additional_info or ""
        questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]

        async def process_interview_redo(pid: str, summarized_codebook: Dict[str, Any]):
            turns = get_interview_data_by_id(pid)
            async for chunk in generate_transcript({"turns": turns}, llm_service.get_llm_and_embeddings(body.model)[0].get_num_tokens):
                for q in questions:
                    parsed = await process_llm_task(
                        workspace_id=workspace_id,
                        app_id=app_id,
                        post_id=pid,
                        manager=llm_queue_manager,
                        llm_model=body.model,
                        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                        prompt_builder_func=InterviewRemakerPrompts.redo_initial_interview_coding_prompt,
                        llm_instance=llm_service.get_llm_and_embeddings(body.model)[0],
                        parent_function_name="redo-initial-coding",
                        function_id=function_id,
                        llm_queue_manager=llm_queue_manager,
                        main_topic=main,
                        additional_info=extra,
                        research_question=q,
                        current_codebook=json.dumps(summarized_codebook),
                        feedback=body.feedback,
                        post_transcript=chunk["transcript"],
                        store_response=True,
                        cacheable_args={"args":[],"kwargs":["main_topic","additional_info","research_question","current_codebook","feedback"]}
                    )
                    codes = parsed if isinstance(parsed, list) else parsed.get("codes", [])
                    for c in codes:
                        c.update(id=str(uuid4()), postId=pid)
                        src = c.get("source", {})
                        if isinstance(src, dict):
                            src.update(post_id=pid)
                            c["source"] = json.dumps(src)
                    filtered = filter_codes_by_transcript(workspace_id, codes, chunk["transcript"], "redo-initial-coding", pid)
                    insert_responses_into_db(filtered, workspace_id, body.model, CodebookType.INITIAL.value, "redo-initial-coding", pid)

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {pid}...")
            prog = function_progress_repo.find_one({"function_id": function_id})
            function_progress_repo.update(
                {"function_id": function_id},
                {"current": prog.current + 1}
            )


        get_batches = lambda: stream_selected_post_ids(workspace_id, ["sampled"])
        return await run_coding_flow(
            function_id=function_id,
            workspace_id=workspace_id,
            app_id=app_id,
            model=body.model,
            llm_queue_manager=llm_queue_manager,
            llm_service=llm_service,
            name="initial",
            codebook_type=CodebookType.INITIAL,
            generation_type=GenerationType.LATEST,
            post_id_type="sampled",
            get_batches=get_batches,
            process_item=process_interview_redo,
            summary_args=summary_args
        )

    elif coll_ctx.type == "reddit":
        main = coding_ctx.main_topic
        extra = coding_ctx.additional_info or ""
        questions = [rq.question for rq in research_question_repo.find({"coding_context_id": workspace_id})]
        concept_table = concept_entries_repo.find({"coding_context_id": workspace_id, "is_marked": True}, map_to_model=False)

        async def process_reddit_redo(pid: str, summarized_codebook: Dict[str, Any]):
            post = get_reddit_post_by_id(workspace_id, pid, ["id","title","selftext"])
            async for chunk in generate_transcript(post, llm_service.get_llm_and_embeddings(body.model)[0].get_num_tokens):
                parsed = await process_llm_task(
                    workspace_id=workspace_id,
                    app_id=app_id,
                    post_id=pid,
                    manager=llm_queue_manager,
                    llm_model=body.model,
                    regex_pattern=r"```json\s*([\s\S]*?)\s*```",
                    prompt_builder_func=RemakerPrompts.redo_initial_coding_prompt,
                    llm_instance=llm_service.get_llm_and_embeddings(body.model)[0],
                    parent_function_name="redo-initial-coding",
                    function_id=function_id,
                    llm_queue_manager=llm_queue_manager,
                    main_topic=main,
                    additional_info=extra,
                    research_questions=questions,
                    concept_table=json.dumps(concept_table),
                    current_codebook=json.dumps(summarized_codebook),
                    feedback=body.feedback,
                    post_transcript=chunk["transcript"],
                    store_response=True,
                    cacheable_args={"args":[],"kwargs":["main_topic","additional_info","research_questions","concept_table","current_codebook","feedback"]}
                )
                codes = parsed if isinstance(parsed, list) else parsed.get("codes", [])
                for c in codes:
                    c.update(id=str(uuid4()), postId=pid)
                    src = c.get("source", {})
                    if isinstance(src, dict) and src.get("type") == "comment":
                        real = chunk["comment_map"].get(f"comment {src['comment_id']}")
                        if real: src["comment_id"] = real
                    if isinstance(src, dict):
                        src.update(post_id=pid)
                        c["source"] = json.dumps(src)
                filtered = filter_codes_by_transcript(workspace_id, codes, chunk["transcript"], "redo-initial-coding", pid)
                insert_responses_into_db(filtered, workspace_id, body.model, CodebookType.INITIAL.value, "redo-initial-coding", pid)

            await send_ipc_message(app_id, f"Dataset {workspace_id}: Generated codes for post {pid}...")
            prog = function_progress_repo.find_one({"function_id": function_id})
            function_progress_repo.update(
                {"function_id": function_id},
                {"current": prog.current + 1}
            )


        get_batches = lambda: stream_selected_post_ids(workspace_id, ["sampled"])
        return await run_coding_flow(
            function_id=function_id,
            workspace_id=workspace_id,
            app_id=app_id,
            model=body.model,
            llm_queue_manager=llm_queue_manager,
            llm_service=llm_service,
            name="initial",
            codebook_type=CodebookType.INITIAL,
            generation_type=GenerationType.LATEST,
            post_id_type="sampled",
            get_batches=get_batches,
            process_item=process_reddit_redo,
            summary_args=summary_args
        )

    else:
        raise HTTPException(status_code=400, detail="Unsupported collection type.")
