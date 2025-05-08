import os
from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Header, Request
from fastapi.responses import FileResponse
import pandas as pd
import tempfile
from typing import Any, Dict, List
import json

from controllers.state_controller import (
    get_grouped_code, 
    get_theme_by_code, 
    dispatch_configs,
    load_functions
)
from database import ( 
    CodingContextRepository,
    CollectionContextRepository,
    ContextFilesRepository,
    GroupedCodeEntriesRepository,
    InitialCodebookEntriesRepository,
    ConceptEntriesRepository,
    ConceptsRepository,
    QectRepository,
    ResearchQuestionsRepository,
    SelectedConceptsRepository,
    SelectedPostIdsRepository,
    ThemeEntriesRepository
)
from constants import FRONTEND_PAGE_MAPPER, PAGE_TO_STATES, TEMP_DIR
from models.table_dataclasses import (
    CodebookType, CodingContext, 
    CollectionContext, ContextFile, 
    Concept, ResearchQuestion, 
    SelectedConcept, SelectedPostId
)

coding_context_repo = CodingContextRepository()
context_files_repo = ContextFilesRepository()
research_question_repo = ResearchQuestionsRepository()
concepts_repo = ConceptsRepository()
selected_concepts_repo = SelectedConceptsRepository()
concept_entries_repo = ConceptEntriesRepository()
qect_repo = QectRepository()
selected_posts_repo = SelectedPostIdsRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()
grouped_codes_repo = GroupedCodeEntriesRepository()
themes_repo = ThemeEntriesRepository()
collection_context_repo = CollectionContextRepository()

router = APIRouter()

@router.post("/save-coding-context")
async def save_coding_context(
    request: Request, 
    request_body: Dict[str, Any] = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id"),
) -> Dict[str, Any]:
    try:
        if not coding_context_repo.find_one({"id": workspace_id}, fail_silently=True):
            coding_context = CodingContext(id=workspace_id)
            coding_context_repo.insert(coding_context)
    except Exception as e:
        print(f"Error finding coding context: {e}")

    operation_type = request_body.get("type")
    if not operation_type:
        raise HTTPException(status_code=400, detail="Operation type is required")
    
    if operation_type in dispatch_configs:
        config = dispatch_configs[operation_type]
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        
        diff = config["process_func"](workspace_id, action)
        if operation_type == "dispatchAllPostResponse":
            sampled_responses = qect_repo.find({"workspace_id": workspace_id, "codebook_type": CodebookType.INITIAL.value})
            unseen_responses = qect_repo.find({"workspace_id": workspace_id, "codebook_type": CodebookType.FINAL.value})
            data = sampled_responses + unseen_responses
        else:
            data = config["repo"].find(config["conditions"](workspace_id))
            print(f"Finding data for operation type: {operation_type}", data)
        
        formatted_data = config["format_func"](data) if operation_type in ["dispatchGroupedCodes", "dispatchThemes"] else [config["format_func"](item) for item in data]
        print("Formatted data:", formatted_data, "operation type:", operation_type)
        return {"success": True, config["response_key"]: formatted_data, "diff": diff}

    if operation_type == "addContextFile":
        file_path = request_body.get("filePath")
        file_name = request_body.get("fileName")
        if not file_path or not file_name:
            raise HTTPException(status_code=400, detail="filePath and fileName are required")
        context_file = ContextFile(coding_context_id=workspace_id, file_path=file_path, file_name=file_name)
        inserted_row = context_files_repo.insert_returning(context_file)
        files = context_files_repo.find({"coding_context_id": workspace_id})
        diff = {"inserted": [inserted_row]}
        return {
            "success": True,
            "contextFiles": {f.file_path: f.file_name for f in files},
            "diff": diff
        }
    
    if operation_type == "addContextFilesBatch":
        print("Adding context files batch", request_body.get("files"))
        files = request_body.get("files")
        if not len(files):
            raise HTTPException(status_code=400, detail="files are required")
        inserted_rows = []
        for file in files:
            context_file = ContextFile(coding_context_id=workspace_id, file_path=file["filePath"], file_name=file["fileName"])
            inserted_rows.append(context_files_repo.insert_returning(context_file))
        files = context_files_repo.find({"coding_context_id": workspace_id})
        diff = {"inserted": inserted_rows}
        return {
            "success": True,
            "contextFiles": {f.file_path: f.file_name for f in files},
            "diff": diff
        }


    elif operation_type == "removeContextFile":
        file_path = request_body.get("filePath")
        if not file_path:
            raise HTTPException(status_code=400, detail="filePath is required")
        deleted_rows = context_files_repo.delete_returning({"coding_context_id": workspace_id, "file_path": file_path})
        files = context_files_repo.find({"coding_context_id": workspace_id})
        diff = {"deleted": deleted_rows}
        return {
            "success": True,
            "contextFiles": {f.file_path: f.file_name for f in files},
            "diff": diff
        }

    elif operation_type == "setMainTopic":
        main_topic = request_body.get("mainTopic")
        if main_topic is None:
            raise HTTPException(status_code=400, detail="mainTopic is required")
        old_context = coding_context_repo.find_one(
            {"id": workspace_id}, columns=["main_topic"], map_to_model=False, fail_silently=True
        )
        old_main_topic = old_context["main_topic"] if old_context else None
        coding_context_repo.update({"id": workspace_id}, {"main_topic": main_topic})
        diff = {"updated": {"main_topic": {"old": old_main_topic, "new": main_topic}}}
        return {"success": True, "mainTopic": main_topic, "diff": diff}

    elif operation_type == "setAdditionalInfo":
        additional_info = request_body.get("additionalInfo")
        if additional_info is None:
            raise HTTPException(status_code=400, detail="additionalInfo is required")
        old_context = coding_context_repo.find_one(
            {"id": workspace_id}, columns=["additional_info"], map_to_model=False, fail_silently=True
        )
        old_additional_info = old_context["additional_info"] if old_context else None
        coding_context_repo.update({"id": workspace_id}, {"additional_info": additional_info})
        diff = {"updated": {"additional_info": {"old": old_additional_info, "new": additional_info}}}
        return {"success": True, "additionalInfo": additional_info, "diff": diff}

    elif operation_type == "setResearchQuestions":
        research_questions = request_body.get("researchQuestions")
        if not isinstance(research_questions, list):
            raise HTTPException(status_code=400, detail="researchQuestions must be a list")
        deleted_rows = research_question_repo.delete_returning({"coding_context_id": workspace_id})
        inserted_rows = []
        for question in research_questions:
            rq = ResearchQuestion(coding_context_id=workspace_id, question=question)
            inserted_row = research_question_repo.insert_returning(rq)
            inserted_rows.append(inserted_row)
        diff = {"deleted": deleted_rows, "inserted": inserted_rows}
        return {"success": True, "researchQuestions": research_questions, "diff": diff}

    elif operation_type == "setConcepts":
        concepts = request_body.get("concepts")
        if not isinstance(concepts, list):
            raise HTTPException(status_code=400, detail="concepts must be a list")
        deleted_rows = concepts_repo.delete_returning({"coding_context_id": workspace_id})
        inserted_rows = []
        for kw in concepts:
            concept = Concept(coding_context_id=workspace_id, word=kw["word"], id=kw["id"])
            inserted_row = concepts_repo.insert_returning(concept)
            inserted_rows.append(inserted_row)
        diff = {"deleted": deleted_rows, "inserted": inserted_rows}
        return {"success": True, "concepts": concepts, "diff": diff}

    elif operation_type == "setSelectedConcepts":
        selected_concepts = request_body.get("selectedConcepts")
        if not isinstance(selected_concepts, list):
            raise HTTPException(status_code=400, detail="selectedConcepts must be a list")
        deleted_rows = selected_concepts_repo.delete_returning({"coding_context_id": workspace_id})
        inserted_rows = []
        for sk in selected_concepts:
            skw = SelectedConcept(coding_context_id=workspace_id, concept_id=sk)
            inserted_row = selected_concepts_repo.insert_returning(skw)
            inserted_rows.append(inserted_row)
        diff = {"deleted": deleted_rows, "inserted": inserted_rows}
        return {"success": True, "selectedConcepts": selected_concepts, "diff": diff}

    elif operation_type == "resetContext":
        context_files_repo.delete({"coding_context_id": workspace_id})
        research_question_repo.delete({"coding_context_id": workspace_id})
        concepts_repo.delete({"coding_context_id": workspace_id})
        selected_concepts_repo.delete({"coding_context_id": workspace_id})
        coding_context_repo.update(
            {"id": workspace_id},
            {"main_topic": None, "additional_info": None}
        )
        return {"success": True, "message": "Context reset successfully"}

    else:
        print(f"Unknown operation type: {operation_type}")
        return {"success": False}

@router.post("/load-coding-context")
async def load_coding_context(
    request: Request, 
    request_body: Dict[str, Any] = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id"),
) -> Dict[str, Any]:
    states: List[str] = request_body.get("states", [])
    if not states:
        states = [
            "mainTopic", "additionalInfo", "contextFiles", "researchQuestions",
            "concepts", "selectedConcepts", "conceptOutlineTable", "sampledPostIds", "sampledPostResponses"
        ]

    response: Dict[str, Any] = {}

    for state in states:
        if state in load_functions:
            response[state] = load_functions[state](workspace_id)

    print(f"Loaded coding context for workspace {workspace_id}: {response}")
    return response

@router.post("/save-collection-context")
async def save_collection_context(
    request: Request, 
    request_body: Dict[str, Any] = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id"),
) -> Dict[str, Any]:
    operation_type = request_body.get("type")
    if not operation_type:
        raise HTTPException(status_code=400, detail="Operation type is required")

    try:
        collection_context = collection_context_repo.find_one({"id": workspace_id})
        if not collection_context:
            raise Exception("Collection context not found")
    except Exception:
        collection_context = CollectionContext(id=workspace_id)
        collection_context_repo.insert(collection_context)

    if operation_type == "setType":
        new_type = request_body.get("newType", None) or "reddit"
        old_context = collection_context_repo.find_one(
            {"id": workspace_id}, columns=["type"], map_to_model=False, fail_silently=True
        )
        old_type = old_context["type"] if old_context else None
        collection_context_repo.update({"id": workspace_id}, {"type": new_type})
        diff = {"updated": {"type": {"old": old_type, "new": new_type}}}
        return {"success": True, "type": new_type, "diff": diff}

    elif operation_type == "setMetadataSource":
        source = request_body.get("source")
        if source not in ["folder", "url"]:
            raise HTTPException(status_code=400, detail="Invalid source")
        if collection_context.type == "interview" and source == "url":
            raise HTTPException(status_code=400, detail="Interview type only allows 'folder' source")
        metadata = json.loads(collection_context.metadata)
        old_source = metadata.get("source")
        metadata["source"] = source
        collection_context_repo.update({"id": workspace_id}, {"metadata": json.dumps(metadata)})
        diff = {"updated": {"metadata.source": {"old": old_source, "new": source}}}
        return {"success": True, "source": source, "diff": diff}


    elif operation_type == "setMetadataSubreddit":
        if collection_context.type != "reddit":
            raise HTTPException(status_code=400, detail="Subreddit can only be set for reddit type")
        subreddit = request_body.get("subreddit")
        old_metadata = json.loads(collection_context.metadata)
        old_subreddit = old_metadata.get("subreddit")
        new_metadata = old_metadata.copy()
        new_metadata["subreddit"] = subreddit
        collection_context_repo.update({"id": workspace_id}, {"metadata": json.dumps(new_metadata)})
        diff = {"updated": {"metadata.subreddit": {"old": old_subreddit, "new": subreddit}}}
        return {"success": True, "subreddit": subreddit, "diff": diff}

    elif operation_type == "setModeInput":
        mode_input = request_body.get("modeInput")
        old_mode_input = collection_context.mode_input
        collection_context_repo.update({"id": workspace_id}, {"mode_input": mode_input})
        diff = {"updated": {"mode_input": {"old": old_mode_input, "new": mode_input}}}
        return {"success": True, "modeInput": mode_input, "diff": diff}

    elif operation_type == "setSelectedData":
        selected_data = request_body.get("selectedData")
        if not isinstance(selected_data, list):
            raise HTTPException(status_code=400, detail="selectedData must be a list")
        deleted_rows = selected_posts_repo.delete_returning({"workspace_id": workspace_id})
        inserted_rows = []
        for post_id in selected_data:
            post = SelectedPostId(workspace_id=workspace_id, post_id=post_id)
            inserted_row = selected_posts_repo.insert_returning(post)
            inserted_rows.append(inserted_row)
        diff = {"deleted": deleted_rows, "inserted": inserted_rows}
        return {"success": True, "selectedData": selected_data, "diff": diff}

    elif operation_type == "setDataFilters":
        data_filters = request_body.get("dataFilters")
        if not isinstance(data_filters, dict):
            raise HTTPException(status_code=400, detail="dataFilters must be a dictionary")
        old_data_filters = collection_context.data_filters
        new_data_filters = json.dumps(data_filters)
        collection_context_repo.update({"id": workspace_id}, {"data_filters": new_data_filters})
        diff = {"updated": {"data_filters": {"old": old_data_filters, "new": new_data_filters}}}
        return {"success": True, "dataFilters": data_filters, "diff": diff}

    elif operation_type == "setIsLocked":
        is_locked = request_body.get("isLocked")
        old_is_locked = collection_context.is_locked
        new_is_locked = bool(is_locked)
        collection_context_repo.update({"id": workspace_id}, {"is_locked": new_is_locked})
        diff = {"updated": {"is_locked": {"old": old_is_locked, "new": new_is_locked}}}
        return {"success": True, "isLocked": new_is_locked, "diff": diff}

    elif operation_type == "resetContext":
        print("Resetting context")
        collection_context_repo.update(
            {"id": workspace_id},
            {
                "type": None,
                "metadata": json.dumps({}),
                "mode_input": None,
                "data_filters": json.dumps({}),
                "is_locked": False
            }
        )
        selected_posts_repo.delete({"workspace_id": workspace_id})
        return {"success": True}

    else:
        print(f"Unknown operation type: {operation_type}")
        return {"success": False}

@router.post("/load-collection-context")
async def load_collection_context(
    request: Request, 
    request_body: Dict[str, Any] = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id"),
) -> Dict[str, Any]:
    states = request_body.get("states", [])
    if not states:
        states = ["type", "metadata", "dataset", "modeInput", "selectedData", "dataFilters", "isLocked"]

    try:
        collection_context = collection_context_repo.find_one({"id": workspace_id})
        if not collection_context:
            raise Exception("Collection context not found")
    except Exception as e:
        print(f"Error finding collection context: {e}")
        collection_context_repo.insert(CollectionContext(id=workspace_id))
        collection_context = collection_context_repo.find_one({"id": workspace_id})

    response = {}
    if "type" in states:
        response["type"] = collection_context.type if hasattr(collection_context, "type") and collection_context.type is not None else "reddit"
    if "metadata" in states:
        response["metadata"] = collection_context.metadata if hasattr(collection_context, "metadata") and collection_context.metadata is not None else {}
    if "modeInput" in states:
        response["modeInput"] = collection_context.mode_input
    if "selectedData" in states:
        response["selectedData"] = list(map(lambda x: x["post_id"], selected_posts_repo.find({"workspace_id": workspace_id}, columns=["post_id"], map_to_model=False))) or []
    if "dataFilters" in states:
        response["dataFilters"] = json.loads(collection_context.data_filters or "{}")
    if "isLocked" in states:
        response["isLocked"] = bool(collection_context.is_locked)

    return response

@router.post("/reset-context-data")
async def reset_context_data_endpoint(
    request: Request,
    request_body: Any = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id"),
):
    request_body = request_body or {}
    page = FRONTEND_PAGE_MAPPER.get(request_body.get("page"), None)

    print(f"Resetting context data for workspace {workspace_id} on page {page}")
    
    if not page or page == "all":
        coding_context_repo.update(
            {"id": workspace_id},
            {"main_topic": None, "additional_info": None}
        )
        context_files_repo.delete({"coding_context_id": workspace_id})
        research_question_repo.delete({"coding_context_id": workspace_id})
        concepts_repo.delete({"coding_context_id": workspace_id})
        selected_concepts_repo.delete({"coding_context_id": workspace_id})
        concept_entries_repo.delete({"coding_context_id": workspace_id})
        qect_repo.delete({"workspace_id": workspace_id})
        initial_codebook_repo.delete({"coding_context_id": workspace_id})
        grouped_codes_repo.delete({"coding_context_id": workspace_id})
        themes_repo.delete({"coding_context_id": workspace_id})
        collection_context_repo.update(
            {"id": workspace_id},
            {
                "type": None,
                "metadata": json.dumps({}),
                "mode_input": None,
                "data_filters": json.dumps({}),
                "is_locked": False
            }
        )
        selected_posts_repo.delete({"workspace_id": workspace_id})
        return {"success": True, "message": "All context data reset successfully"}
    
    if page == "context":
        coding_context_repo.update(
            {"id": workspace_id},
            {"main_topic": None, "additional_info": None}
        )
        context_files_repo.delete({"coding_context_id": workspace_id})
        research_question_repo.delete({"coding_context_id": workspace_id})
    elif page ==  "related_concepts":
        concepts_repo.delete({"coding_context_id": workspace_id})
        selected_concepts_repo.delete({"coding_context_id": workspace_id})
    elif page == "concept_outline":
        concept_entries_repo.delete({"coding_context_id": workspace_id})
    elif page == "initial_coding":
        qect_repo.delete({
            "workspace_id": workspace_id,
            "codebook_type": CodebookType.INITIAL.value
        })
    elif page == "initial_codebook":
        initial_codebook_repo.delete({"coding_context_id": workspace_id})
    elif page == "final_coding":
        qect_repo.delete({
            "workspace_id": workspace_id,
            "codebook_type": [CodebookType.FINAL.value, CodebookType.INITIAL_COPY.value]
        })
    elif page == "reviewing_codes":
        grouped_codes_repo.delete({"coding_context_id": workspace_id})
    elif page == "generating_themes":
        themes_repo.delete({"coding_context_id": workspace_id})
    elif page == "data_source":
        collection_context_repo.update(
            {"id": workspace_id},
            {"mode_input": None}
        )
    elif page == "dataset_creation":
        selected_posts_repo.delete({"workspace_id": workspace_id})
        collection_context_repo.update(
            {"id": workspace_id},
            {"data_filters": json.dumps({}), "is_locked": False}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid page")
    
    return {"success": True, "message": f"Context data for {page} reset successfully"}


@router.post("/check-data-existence")
async def check_data_existence(
    request: Request, 
    request_body: Dict[str, Any] = Body(...),
    workspace_id: str = Header(..., alias="x-workspace-id"),
) -> Dict[str, bool]:
    page = request_body.get("page")
    if not page:
        raise HTTPException(status_code=400, detail="page is required")
    
    print(f"Checking data existence for workspace {workspace_id} on page {page}")
    states = PAGE_TO_STATES.get(FRONTEND_PAGE_MAPPER.get(page), [])
    if not states:
        return {"exists": False}

    exists = False
    for state in states:
        if state == "contextFiles":
            exists |= context_files_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "mainTopic":
            coding_context = coding_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists |= (coding_context is not None) and (coding_context.main_topic is not None)
        elif state == "additionalInfo":
            coding_context = coding_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists |= (coding_context is not None) and (coding_context.additional_info is not None)
        elif state == "researchQuestions":
            exists |= research_question_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "concepts":
            exists |= concepts_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "selectedConcepts":
            exists |= selected_concepts_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "conceptOutlineTable":
            exists |= concept_entries_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "sampledPostResponse":
            exists |= qect_repo.count({"workspace_id": workspace_id, "codebook_type": CodebookType.INITIAL.value}) > 0
        elif state == "sampledPostIds":
            exists |= selected_posts_repo.count({"workspace_id": workspace_id, "type": "sampled"}) > 0
        elif state == "unseenPostIds":
            exists |= selected_posts_repo.count({"workspace_id": workspace_id, "type": "unseen"}) > 0
        elif state == "unseenPostResponse":
            exists |= qect_repo.count({"workspace_id": workspace_id, "codebook_type": CodebookType.FINAL.value}) > 0
        elif state == "sampledCopyPostResponse":
            exists |= qect_repo.count({"workspace_id": workspace_id, "codebook_type": CodebookType.INITIAL_COPY.value}) > 0
        elif state == "initialCodebookTable":
            exists |= initial_codebook_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "groupedCodes":
            exists |= grouped_codes_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "themes":
            exists |= themes_repo.count({"coding_context_id": workspace_id}) > 0
        elif state == "type":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists |= (collection_context is not None) and (collection_context.type is not None)
        elif state == "modeInput":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists |= (collection_context is not None) and (collection_context.mode_input is not None)
        elif state == "selectedData":
            exists |= selected_posts_repo.count({"workspace_id": workspace_id}) > 0
        elif state == "dataFilters":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists |= (collection_context is not None) and (collection_context.data_filters is not None) and (collection_context.data_filters != json.dumps({}))
        elif state == "isLocked":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists |= (collection_context is not None) and collection_context.is_locked

    print(f"Data existence check for workspace {workspace_id} on page {page}: {exists}")
    return {"exists": bool(exists)}

@router.post("/download-context-data")
async def download_data(
    request: Request, 
    background_tasks: BackgroundTasks,
    request_body: Dict[str, Any] = Body(...),
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    page = request_body.get("page")

    print(f"Downloading data for workspace {workspace_id} on page {page}")

    mapped_page = FRONTEND_PAGE_MAPPER.get(page, page)
    if not page:
        raise HTTPException(status_code=400, detail="page is required")

    download_configs = {
        "initial_coding": {
            "name": "initial_coding",
            "data_func": lambda: qect_repo.find({
                "workspace_id": workspace_id,
                "codebook_type": CodebookType.INITIAL.value
            })
        },
        "initial_codebook": {
            "name": "initial_codebook",
            "data_func": lambda: initial_codebook_repo.find({"coding_context_id": workspace_id})
        },
        "final_coding": {
            "name": "final_codebook",
            "data_func": lambda: qect_repo.find({
                "workspace_id": workspace_id,
                "codebook_type": CodebookType.FINAL.value
            })
        },
        "reviewing_codes": {
            "name": "codebook_with_grouped_codes",
            "data_func": lambda: [
                {**post, "code": get_grouped_code(post.get("code", ""), workspace_id)}
                for post in qect_repo.find({"workspace_id": workspace_id})
            ]
        },
        "generating_themes": {
            "name": "codebook_with_themes",
            "data_func": lambda: [
                {**post, "theme": get_theme_by_code(post.get("code", ""), workspace_id)}
                for post in qect_repo.find({"workspace_id": workspace_id})
            ]
        },
    }

    config = download_configs.get(mapped_page)
    if not config:
        raise HTTPException(status_code=404, detail="No download config for this path")

    data = config["data_func"]()
    if not data:
        raise HTTPException(status_code=404, detail="No data found for download")

    df = pd.DataFrame([d if isinstance(d, dict) else d.__dict__ for d in data])
    csv_data = df.to_csv(index=False)
    os.makedirs(TEMP_DIR, exist_ok=True)

    with tempfile.NamedTemporaryFile(mode='w', delete=False, dir=TEMP_DIR, suffix='.csv') as temp_file:
        temp_file.write(csv_data)
        temp_file_path = temp_file.name

    def delete_temp_file(path: str):
        try:
            os.remove(path)
            print(f"Temporary file {path} deleted.")
        except Exception as e:
            print(f"Error deleting temporary file {path}: {e}")

    background_tasks.add_task(delete_temp_file, temp_file_path)

    return FileResponse(
        path=temp_file_path,
        media_type="text/csv",
        filename=f"{config['name']}.csv",
        background=background_tasks
    )