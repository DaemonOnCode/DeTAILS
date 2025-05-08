import json
from uuid import uuid4
from fastapi import APIRouter, Depends, Header, Request

from controllers.coding_controller import process_llm_task, summarize_codebook_explanations
from database import (
    FunctionProgressRepository, 
    QectRepository, 
    CodingContextRepository,
    SelectedPostIdsRepository,
    ResearchQuestionsRepository,
    ConceptEntriesRepository,
    InitialCodebookEntriesRepository,
    ThemeEntriesRepository,
    GroupedCodeEntriesRepository
)
from errors.request_errors import RequestError
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from models.coding_models import GroupCodesRequest,  RegroupCodesRequest
from models.table_dataclasses import CodebookType, GroupedCodeEntry
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from routes.websocket_routes import manager
from utils.prompts import GroupCodes

router = APIRouter(dependencies=[Depends(get_app_id), Depends(get_workspace_id)])


function_progress_repo = FunctionProgressRepository()
coding_context_repo = CodingContextRepository()
research_question_repo = ResearchQuestionsRepository()
concept_entries_repo = ConceptEntriesRepository()
selected_post_ids_repo = SelectedPostIdsRepository()
qect_repo = QectRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()
grouped_codes_repo = GroupedCodeEntriesRepository()
themes_repo = ThemeEntriesRepository()


@router.post("/group-codes")
async def group_codes_endpoint(
    request: Request,
    request_body: GroupCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id"),
):
    if qect_repo.count({"workspace_id": workspace_id, "codebook_type": [CodebookType.INITIAL_COPY.value,CodebookType.FINAL.value], "is_marked": True}) == 0:
        raise RequestError(status_code=400, message="No codes available for grouping.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    summarized_explanations = await summarize_codebook_explanations(
        workspace_id=workspace_id,
        codebook_types=[CodebookType.INITIAL_COPY.value, CodebookType.FINAL.value],
        llm_model=request_body.model,
        app_id=app_id,
        manager=manager,
        parent_function_name="group-codes",
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        max_input_tokens=128000,        
        retries=3,
        flush_threshold=200,             
        page_size=500,              
        concurrency_limit=4,
        store_response=False
    )


    code_summary_table = [
        {"code": code, "summary": summary}
        for code, summary in summarized_explanations.items()
    ]

    try:
        grouped_codes_repo.delete({"coding_context_id": workspace_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        manager=manager,
        llm_model=request_body.model,
        parent_function_name="group-codes",
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GroupCodes.group_codes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps([summary["code"] for summary in code_summary_table]),
        qec_table=json.dumps(code_summary_table)
    )

    print(parsed_response)

    if isinstance(parsed_response, list):
        parsed_response = {"higher_level_codes": parsed_response}

    higher_level_codes = parsed_response.get("higher_level_codes", [])
    for higher_level_code in higher_level_codes:
        higher_level_code["id"] = str(uuid4())

    placed = {code for hl in higher_level_codes for code in hl["codes"]}
    all_codes = set(summarized_explanations.keys())
    unplaced_codes = list(all_codes - placed)

    grouped_codes_repo.insert_batch([
        GroupedCodeEntry(
            code=code, 
            higher_level_code = higher_level_code["name"],
            higher_level_code_id = higher_level_code["id"],
            coding_context_id=workspace_id,
        ) 
        for higher_level_code in higher_level_codes for code in higher_level_code["codes"]
    ])

    if len(unplaced_codes) > 0:
        grouped_codes_repo.insert_batch([
            GroupedCodeEntry(
                code=code, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=workspace_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        grouped_codes_repo.insert(
            GroupedCodeEntry(
                code=None, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=workspace_id,
            ) 
        )

    return {
        "message": "Codes grouped successfully!",
    }

@router.post("/regroup-codes")
async def regroup_codes_endpoint(
    request: Request,
    request_body: RegroupCodesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id"),
):
    if qect_repo.count({"workspace_id": workspace_id, "codebook_type": [CodebookType.INITIAL_COPY.value,CodebookType.FINAL.value], "is_marked": True}) == 0:
        raise RequestError(status_code=400, message="No codes available for grouping.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    summarized_explanations = await summarize_codebook_explanations(
        workspace_id = workspace_id,
        codebook_types = [
            CodebookType.INITIAL_COPY.value,
            CodebookType.FINAL.value
        ],
        llm_model = request_body.model,
        app_id = app_id,
        manager = manager,
        parent_function_name = "regroup-codes",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )

    code_summary_table = [
        {"code": code, "summary": summary}
        for code, summary in summarized_explanations.items()
    ]


    previous_codes = grouped_codes_repo.find({"coding_context_id": workspace_id}, map_to_model=False)
    previous_codes_json = json.dumps(previous_codes)

    try:
        grouped_codes_repo.delete({"coding_context_id": workspace_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GroupCodes.regroup_codes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        parent_function_name="regroup-codes",
        codes=json.dumps([summary["code"] for summary in code_summary_table]),
        qec_table=json.dumps(code_summary_table),
        previous_codes=previous_codes_json,
        feedback=request_body.feedback
    )

    print(parsed_response)

    if isinstance(parsed_response, list):
        parsed_response = {"higher_level_codes": parsed_response}

    higher_level_codes = parsed_response.get("higher_level_codes", [])
    for higher_level_code in higher_level_codes:
        higher_level_code["id"] = str(uuid4())

    placed_codes = {code for higher_level_code in higher_level_codes for code in higher_level_code["codes"]}
    all_codes = set(summarized_explanations.keys())
    unplaced_codes = list(all_codes - placed_codes)

    grouped_codes_repo.insert_batch([
        GroupedCodeEntry(
            code=code, 
            higher_level_code = higher_level_code["name"],
            higher_level_code_id = higher_level_code["id"],
            coding_context_id=workspace_id,
        ) 
        for higher_level_code in higher_level_codes for code in higher_level_code["codes"]
    ])

    if len(unplaced_codes) > 0:
        grouped_codes_repo.insert_batch([
            GroupedCodeEntry(
                code=code, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=workspace_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        grouped_codes_repo.insert(
            GroupedCodeEntry(
                code=None, 
                higher_level_code = None,
                higher_level_code_id = None,
                coding_context_id=workspace_id,
            ) 
        )


    return {
        "message": "Codes regrouped successfully!",
    }
