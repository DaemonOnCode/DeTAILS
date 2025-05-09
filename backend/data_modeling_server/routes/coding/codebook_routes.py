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
    GroupedCodeEntriesRepository,
)
from errors.request_errors import RequestError
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from models.coding_models import GenerateCodebookWithoutQuotesRequest, RegenerateCodebookWithoutQuotesRequest
from models.table_dataclasses import CodebookType, InitialCodebookEntry
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from routes.websocket_routes import manager
from utils.prompts import GenerateCodebookWithoutQuotes

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

@router.post("/generate-codebook-without-quotes")
async def generate_codebook_without_quotes_endpoint(
    request: Request,
    request_body: GenerateCodebookWithoutQuotesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id"),
):
    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    codebook_types = [CodebookType.INITIAL.value]

    if qect_repo.count({"workspace_id": workspace_id, "codebook_type": codebook_types, "is_marked": True}) == 0:
        raise RequestError(status_code=400, message="No responses available.")
    
    function_name = "initial_codebook"
    
    summarized_dict = await summarize_codebook_explanations(
        workspace_id = workspace_id,
        codebook_types = codebook_types,
        llm_model = request_body.model,
        app_id = app_id,
        manager = manager,
        parent_function_name = function_name,
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )
    
    summarized_grouped_ec = {code: [summary] for code, summary in summarized_dict.items()}

    print(summarized_grouped_ec)

    try:
        initial_codebook_repo.delete({"coding_context_id": workspace_id})
    except Exception as e:
        print(e)
    
    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        manager=manager,
        llm_model=request_body.model,
        parent_function_name=function_name,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GenerateCodebookWithoutQuotes.generate_codebook_without_quotes_prompt,
        llm_instance=llm,
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps(summarized_grouped_ec)  
    )
    
    initial_codebook_repo.insert_batch(
        [
            InitialCodebookEntry(
                id=str(uuid4()),
                coding_context_id=request.headers.get("x-workspace-id"),
                code= pr[0],
                definition= pr[1]
            ) for pr in  parsed_response.items() 
        ]
    )


    return {
        "message": "Codebook generated successfully!",
    }
    
@router.post("/regenerate-codebook-without-quotes")
async def regenerate_codebook_without_quotes_endpoint(
    request: Request,
    request_body: RegenerateCodebookWithoutQuotesRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id = Header(..., alias="x-workspace-id"),
):
    app_id = request.headers.get("x-app-id")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    summarized_dict = await summarize_codebook_explanations(
        workspace_id = workspace_id,
        codebook_types = [CodebookType.INITIAL.value],
        llm_model = request_body.model,
        app_id = app_id,
        manager = manager,
        parent_function_name = "initial_codebook",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        max_input_tokens = 128000,
        retries = 3,
        flush_threshold = 200,
        page_size = 500,
        concurrency_limit = 4,
        store_response = False
    )

    summarized_grouped_ec = {code: [summary] for code, summary in summarized_dict.items()}

    previous_codebook = initial_codebook_repo.find_one({"coding_context_id": workspace_id}, map_to_model=False)

    previous_codebook_json = json.dumps(previous_codebook)

    try:
        initial_codebook_repo.delete({"coding_context_id": workspace_id})
    except Exception as e:
        print(e)

    parsed_response = await process_llm_task(
        workspace_id=request.headers.get("x-workspace-id"),
        app_id=app_id,
        manager=manager,
        llm_model=request_body.model,
        regex_pattern=r"```json\s*([\s\S]*?)\s*```",
        prompt_builder_func=GenerateCodebookWithoutQuotes.regenerate_codebook_without_quotes_prompt,
        llm_instance=llm,
        parent_function_name="initial_codebook",
        llm_queue_manager=llm_queue_manager,
        codes=json.dumps(summarized_grouped_ec),  
        previous_codebook=previous_codebook_json  ,
        feedback = request_body.feedback
    )

    initial_codebook_repo.insert_batch(
        [
            InitialCodebookEntry(
                id=str(uuid4()),
                coding_context_id=request.headers.get("x-workspace-id"),
                code= pr[0],
                definition= pr[1],
            ) for pr in  parsed_response.items() 
        ]
    )

    return {
        "message": "Codebook regenerated successfully!",
    }
