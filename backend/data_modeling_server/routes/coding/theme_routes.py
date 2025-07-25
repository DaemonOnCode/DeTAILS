import asyncio
import json
from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, Header, Request

from controllers.coding_controller import batch_llm_hierarchy, summarize_codebook_explanations
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
from headers.app_id import get_app_id
from headers.workspace_id import get_workspace_id
from ipc import send_ipc_message
from models.coding_models import RedoThemeGenerationRequest, ThemeGenerationRequest
from models.table_dataclasses import CodebookType, ThemeEntry
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.llm_service import GlobalQueueManager, get_llm_manager
from routes.websocket_routes import manager
from utils.prompts import ThemeGeneration


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



@router.post("/theme-generation")
async def theme_generation_endpoint(
    request: Request,
    request_body: ThemeGenerationRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id"),
):
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Theme generation process started.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    def to_higher(code: str) -> Optional[str]:
        entry = grouped_codes_repo.find_one({
            "coding_context_id": workspace_id,
            "code": code
        })
        return entry.higher_level_code if entry else None

    summaries = await summarize_codebook_explanations(
        workspace_id = workspace_id,
        codebook_types = [
            CodebookType.INITIAL_COPY.value,
            CodebookType.FINAL.value
        ],
        llm_model = request_body.model,
        app_id = app_id,
        manager = manager,
        parent_function_name = "theme-generation",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        code_transform = to_higher,
        max_input_tokens = 8000,
        retries = 3,
        flush_threshold = 200,
        page_size = 100,
        concurrency_limit = 4,
        store_response = False
    )

    qec_table = [
        {"code": code, "summary": summaries[code]}
        for code in summaries
    ]

    print(qec_table)

    try:
        themes_repo.delete({"coding_context_id": workspace_id})
    except Exception as e:
        print(e)

    themes = await batch_llm_hierarchy(
        workspace_id = workspace_id,
        app_id = app_id,
        manager = manager,
        llm_model = request_body.model,
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        item_table = qec_table,
        initial_prompt = lambda codes, qec_table: ThemeGeneration.theme_generation_prompt(
            qec_table=qec_table,
            unique_codes=codes
        ),
        continuation_prompt = lambda existing, codes, qec_table: ThemeGeneration.theme_generation_continuation_prompt(
            existing_themes=existing,
            qec_table=qec_table,
            unique_codes=codes
        ),
        parent_fn_base = "theme-generation",
        parse_key = "themes",
        chunk_size = 50,
        retries = 3,
    )

    for theme in themes:
        theme["id"] = str(uuid4())

    placed_codes = {code for theme in themes for code in theme["codes"]}
    unplaced_codes = list(set(summaries.keys()) - placed_codes)

    themes_repo.insert_batch([
        ThemeEntry(
            higher_level_code=code, 
            theme=theme["theme"], 
            theme_id=theme["id"],
            coding_context_id=workspace_id,
        ) 
        for theme in themes for code in theme["codes"] 
    ])

    if len(unplaced_codes) > 0:
        themes_repo.insert_batch([
            ThemeEntry(
                higher_level_code=code, 
                theme=None,
                theme_id=None,
                coding_context_id=workspace_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        themes_repo.insert(
            ThemeEntry(
                higher_level_code=None, 
                theme=None,
                theme_id=None,
                coding_context_id=workspace_id,
            ) 
        )

    await send_ipc_message(app_id, f"Dataset {workspace_id}: Theme generation completed.")

    await asyncio.sleep(5)

    return {
        "message": "Themes generated successfully!",
    }


@router.post("/redo-theme-generation")
async def redo_theme_generation_endpoint(
    request: Request,
    request_body: RedoThemeGenerationRequest,
    llm_queue_manager: GlobalQueueManager = Depends(get_llm_manager),
    llm_service: LangchainLLMService = Depends(get_llm_service),
    workspace_id: str = Header(..., alias="x-workspace-id"),
    app_id: str = Header(..., alias="x-app-id"),
):
    await send_ipc_message(app_id, f"Dataset {workspace_id}: Theme generation redo process started.")

    llm, _ = llm_service.get_llm_and_embeddings(request_body.model)

    def to_higher(code: str) -> Optional[str]:
        entry = grouped_codes_repo.find_one({
            "coding_context_id": workspace_id,
            "code": code
        })
        return entry.higher_level_code if entry else None

    summaries = await summarize_codebook_explanations(
        workspace_id = workspace_id,
        llm_model = request_body.model,
        app_id = app_id,
        manager = manager,
        parent_function_name = "redo-theme-generation",
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        codebook_types = [
            CodebookType.INITIAL_COPY.value,
            CodebookType.FINAL.value
        ],
        code_transform = to_higher,
        max_input_tokens = 8000,
        retries = 3,
        flush_threshold = 200,
        page_size = 100,
        concurrency_limit = 4,
        store_response = False
    )

    qec_table = [
        {"code": code, "summary": summaries[code]}
        for code in summaries
    ]

    previous_themes = themes_repo.find({"coding_context_id": workspace_id}, map_to_model=False)

    print(qec_table)

    try:
        themes_repo.delete({"coding_context_id": workspace_id})
    except Exception as e:
        print(e)

    themes = await batch_llm_hierarchy(
        workspace_id = workspace_id,
        app_id = app_id,
        manager = manager,
        llm_model = request_body.model,
        llm_instance = llm,
        llm_queue_manager = llm_queue_manager,
        item_table = qec_table,
        initial_prompt = lambda codes, qec_table: ThemeGeneration.redo_theme_generation_prompt(
            qec_table=qec_table,
            unique_codes=codes,
            previous_themes=json.dumps(previous_themes),
            feedback=request_body.feedback
        ),
        continuation_prompt = lambda existing, codes, qec_table: ThemeGeneration.redo_theme_generation_continuation_prompt(
            previous_themes=json.dumps(previous_themes),
            feedback=request_body.feedback,
            existing_themes=existing,
            qec_table=qec_table,
            unique_codes=codes
        ),
        parent_fn_base = "redo-theme-generation",
        parse_key = "themes",
        chunk_size = 50,
        retries = 3,
    )

    for theme in themes:
        theme["id"] = str(uuid4())

    placed_codes = {code for theme in themes for code in theme["codes"]}
    unplaced_codes = list(set(summaries.keys()) - placed_codes)

    themes_repo.insert_batch([
        ThemeEntry(
            higher_level_code=code, 
            theme=theme["theme"], 
            theme_id=theme["id"],
            coding_context_id=workspace_id,
        ) 
        for theme in themes for code in theme["codes"] 
    ])

    if len(unplaced_codes) > 0:
        themes_repo.insert_batch([
            ThemeEntry(
                higher_level_code=code, 
                theme=None,
                theme_id=None,
                coding_context_id=workspace_id,
            ) 
            for code in unplaced_codes
        ])
    else:
        themes_repo.insert(
            ThemeEntry(
                higher_level_code=None, 
                theme=None,
                theme_id=None,
                coding_context_id=workspace_id,
            ) 
        )


    await send_ipc_message(app_id, f"Dataset {workspace_id}: Theme generation redo completed.")

    await asyncio.sleep(5)

    return {
        "message": "Themes regenerated successfully!",
    }
