from collections import defaultdict
from datetime import datetime
import json
import os
import shutil
import tempfile
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, Body, Request
from fastapi.responses import FileResponse
import pandas as pd

from constants import FRONTEND_PAGE_MAPPER, PAGE_TO_STATES, TEMP_DIR
from controllers.state_controller import delete_state, export_workspace, get_grouped_code, get_theme_by_code, import_workspace, load_state, save_state
from database.coding_context_table import CodingContextRepository
from database.collection_context_table import CollectionContextRepository
from database.context_file_table import ContextFilesRepository
from database.grouped_code_table import GroupedCodeEntriesRepository
from database.initial_codebook_table import InitialCodebookEntriesRepository
from database.keyword_entry_table import KeywordEntriesRepository
from database.keyword_table import KeywordsRepository
from database.manual_codebook_table import ManualCodebookEntriesRepository
from database.manual_post_state_table import ManualPostStatesRepository
from database.qect_table import QectRepository
from database.research_question_table import ResearchQuestionsRepository
from database.selected_keywords_table import SelectedKeywordsRepository
from database.selected_post_ids_table import SelectedPostIdsRepository
from database.theme_table import ThemeEntriesRepository
from models.state_models import LoadStateRequest, SaveStateRequest
from models.table_dataclasses import CodebookType, CodingContext, CollectionContext, ContextFile, GenerationType, Keyword, ManualCodebookEntry, ManualPostState, ResearchQuestion, SelectedKeyword, SelectedPostId
from utils.reducers import process_grouped_codes_action, process_initial_codebook_table_action, process_keyword_table_action, process_manual_coding_responses_action, process_sampled_post_response_action, process_themes_action, process_unseen_post_response_action


router = APIRouter()

@router.post("/save-state")
async def save_state_endpoint(request: SaveStateRequest):
    if request.workspace_id is None or request.workspace_id == "":
        raise HTTPException(status_code=400, detail="workspace_id is required")
    try:
        save_state(request)
        return {"success": True, "message": "State saved successfully"}

    except Exception as e:
        print(f"Error saving state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

coding_context_repo = CodingContextRepository()
context_files_repo = ContextFilesRepository()
research_question_repo = ResearchQuestionsRepository()
keywords_repo = KeywordsRepository()
selected_keywords_repo = SelectedKeywordsRepository()
keyword_entries_repo = KeywordEntriesRepository()
qect_repo = QectRepository()
selected_posts_repo = SelectedPostIdsRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()
grouped_codes_repo = GroupedCodeEntriesRepository()
themes_repo = ThemeEntriesRepository()

@router.post("/save-coding-context")
async def save_coding_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    try:
        coding_context = coding_context_repo.find_one({"id": workspace_id})
        if not coding_context:
            raise Exception("Coding context not found")
    except:
        coding_context = CodingContext(id=workspace_id)
        coding_context_repo.insert(coding_context)

    operation_type = request_body.get("type")
    if not operation_type:
        raise HTTPException(status_code=400, detail="Operation type is required")

    if operation_type == "addContextFile":
        file_path = request_body.get("filePath")
        file_name = request_body.get("fileName")
        if not file_path or not file_name:
            raise HTTPException(status_code=400, detail="filePath and fileName are required")
        context_file = ContextFile(coding_context_id=workspace_id, file_path=file_path, file_name=file_name)
        context_files_repo.insert(context_file)
        files = context_files_repo.find({"coding_context_id": workspace_id})
        return {"success": True, "contextFiles": {f.file_path: f.file_name for f in files}}

    elif operation_type == "removeContextFile":
        file_path = request_body.get("filePath")
        if not file_path:
            raise HTTPException(status_code=400, detail="filePath is required")
        context_files_repo.delete({"coding_context_id": workspace_id, "file_path": file_path})
        files = context_files_repo.find({"coding_context_id": workspace_id})
        return {"success": True, "contextFiles": {f.file_path: f.file_name for f in files}}

    elif operation_type == "setMainTopic":
        main_topic = request_body.get("mainTopic")
        if main_topic is None:
            raise HTTPException(status_code=400, detail="mainTopic is required")
        coding_context_repo.update({"id": workspace_id}, {"main_topic": main_topic})
        return {"success": True, "mainTopic": main_topic}

    elif operation_type == "setAdditionalInfo":
        additional_info = request_body.get("additionalInfo")
        if additional_info is None:
            raise HTTPException(status_code=400, detail="additionalInfo is required")
        coding_context_repo.update({"id": workspace_id}, {"additional_info": additional_info})
        return {"success": True, "additionalInfo": additional_info}

    elif operation_type == "setResearchQuestions":
        research_questions = request_body.get("researchQuestions")
        if not isinstance(research_questions, list):
            raise HTTPException(status_code=400, detail="researchQuestions must be a list")
        research_question_repo.delete({"coding_context_id": workspace_id})
        for question in research_questions:
            rq = ResearchQuestion(coding_context_id=workspace_id, question=question)
            research_question_repo.insert(rq)
        return {"success": True, "researchQuestions": research_questions}

    elif operation_type == "setKeywords":
        keywords = request_body.get("keywords")
        if not isinstance(keywords, list):
            raise HTTPException(status_code=400, detail="keywords must be a list")
        keywords_repo.delete({"coding_context_id": workspace_id})
        for kw in keywords:
            keyword = Keyword(coding_context_id=workspace_id, word=kw["word"], id=kw["id"])
            keywords_repo.insert(keyword)
        return {"success": True, "keywords": keywords}

    elif operation_type == "setSelectedKeywords":
        selected_keywords = request_body.get("selectedKeywords")
        if not isinstance(selected_keywords, list):
            raise HTTPException(status_code=400, detail="selectedKeywords must be a list")
        selected_keywords_repo.delete({"coding_context_id": workspace_id})
        for sk in selected_keywords:
            skw = SelectedKeyword(coding_context_id=workspace_id, keyword_id=sk)
            selected_keywords_repo.insert(skw)
        return {"success": True, "selectedKeywords": selected_keywords}

    elif operation_type == "resetContext":
        context_files_repo.delete({"coding_context_id": workspace_id})
        research_question_repo.delete({"coding_context_id": workspace_id})
        keywords_repo.delete({"coding_context_id": workspace_id})
        selected_keywords_repo.delete({"coding_context_id": workspace_id})
        coding_context_repo.update(
            {"id": workspace_id},
            {"main_topic": None, "additional_info": None}
        )
        return {"success": True, "message": "Context reset successfully"}

    elif operation_type == "dispatchKeywordsTable":
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        process_keyword_table_action(workspace_id, action)
        
        keyword_entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        keyword_table = [
            {
                "id": ke.id,
                "word": ke.word,
                "description": ke.description,
                "inclusion_criteria": ke.inclusion_criteria,
                "exclusion_criteria": ke.exclusion_criteria,
                "isMarked": bool(ke.is_marked)
            }
            for ke in keyword_entries
        ]
        return {"success": True, "keywordTable": keyword_table}
    elif operation_type == "dispatchSampledPostResponse":
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        process_sampled_post_response_action(workspace_id, action)
        sampled_responses = qect_repo.find({
            "workspace_id": workspace_id,
            "codebook_type": CodebookType.INITIAL.value
        })
        return {"success": True, "sampledPostResponse": [{
            "id": response.id,
            "quote": response.quote,
            "code": response.code,
            "explanation": response.explanation,
            "postId": response.post_id,
            "chatHistory": json.loads(response.chat_history) if response.chat_history else None,
            "isMarked": bool(response.is_marked),
            "comment": "",
            "rangeMarker": json.loads(response.range_marker) if response.range_marker else None,
        } for response in sampled_responses]}
    
    elif operation_type == "dispatchInitialCodebookTable":
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        process_initial_codebook_table_action(workspace_id, action)
        codebook_entries = initial_codebook_repo.find({"coding_context_id": workspace_id})  
        return {"success": True, "initialCodebookTable": [entry.to_dict() for entry in codebook_entries]}
    
    elif operation_type == "setUnseenPostIds":
        post_ids = request_body.get("unseenPostIds")
        dataset_id = request_body.get("datasetId", workspace_id)
        if not isinstance(post_ids, list):
            raise HTTPException(status_code=400, detail="unseenPostIds must be a list")
        selected_posts_repo.delete({"dataset_id": dataset_id, "type": "unseen"})
        for post_id in post_ids:
            selected_posts_repo.insert(SelectedPostId(dataset_id=dataset_id, post_id=post_id, type="unseen"))
        return {"success": True, "unseenPostIds": post_ids}
    
    elif operation_type == "dispatchUnseenPostResponse":
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        process_unseen_post_response_action(workspace_id, action)
        unseen_responses = qect_repo.find({
            "workspace_id": workspace_id,
            "codebook_type": CodebookType.FINAL.value,
        })
        return {"success": True, "unseenPostResponse": [{
            "id": response.id,
            "quote": response.quote,
            "code": response.code,
            "explanation": response.explanation,
            "postId": response.post_id,
            "chatHistory": json.loads(response.chat_history) if response.chat_history else None,
            "isMarked": bool(response.is_marked),
            "comment": "",
            "rangeMarker": json.loads(response.range_marker) if response.range_marker else None,
            "type": response.response_type,
        } for response in unseen_responses]}
    
    elif operation_type == "dispatchGroupedCodes":
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        process_grouped_codes_action(workspace_id, action)
        grouped_entries = grouped_codes_repo.find({"coding_context_id": workspace_id})
        grouped_codes_dict = defaultdict(list)
        higher_level_codes = {}
        for entry in grouped_entries:
            grouped_codes_dict[entry.higher_level_code_id].append(entry.code)
            if entry.higher_level_code_id not in higher_level_codes:
                higher_level_codes[entry.higher_level_code_id] = entry.higher_level_code
        grouped_codes = [
            {"id": hid, "name": higher_level_codes[hid], "codes": list(filter(bool, codes))}
            for hid, codes in grouped_codes_dict.items()
        ]
        print(f"Grouped codes: {grouped_codes}")
        return {"success": True, "groupedCodes": grouped_codes}

    elif operation_type == "dispatchThemes":
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        process_themes_action(workspace_id, action)
        theme_entries = themes_repo.find({"coding_context_id": workspace_id})
        themes_dict = defaultdict(list)
        theme_names = {}
        for entry in theme_entries:
            themes_dict[entry["theme_id"]].append(entry["higher_level_code"])
            if entry["theme_id"] not in theme_names:
                theme_names[entry["theme_id"]] = entry["theme"]
        themes = [
            {"id": tid, "name": theme_names[tid], "codes": list(filter(bool, codes))}
            for tid, codes in themes_dict.items()
        ]
        return {"success": True, "themes": themes}
    else:
        print(f"Unknown operation type: {operation_type}")
        return {"success": False}

@router.post("/load-coding-context")
async def load_coding_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    states: List[str] = request_body.get("states", [])
    if not states:
        states = [
            "mainTopic", "additionalInfo", "contextFiles", "researchQuestions",
            "keywords", "selectedKeywords", "keywordTable", "sampledPostIds", "sampledPostResponses"
        ]

    response: Dict[str, Any] = {}

    try:
        if any(state in ["mainTopic", "additionalInfo"] for state in states):
            coding_context = coding_context_repo.find_one({"id": workspace_id})
        else:
            coding_context = None
    except Exception:
        coding_context = None

    
    if "mainTopic" in states:
        response["mainTopic"] = coding_context.main_topic or "" if coding_context else ""
    if "additionalInfo" in states:
        response["additionalInfo"] = coding_context.additional_info or "" if coding_context else ""
    if "contextFiles" in states:
        context_files = context_files_repo.find({"coding_context_id": workspace_id})
        response["contextFiles"] = {file.file_path: file.file_name for file in context_files}
    if "researchQuestions" in states:
        research_questions = research_question_repo.find({"coding_context_id": workspace_id})
        response["researchQuestions"] = [rq.question for rq in research_questions]
    if "keywords" in states:
        keywords = keywords_repo.find({"coding_context_id": workspace_id})
        response["keywords"] = [{"id": kw.id, "word": kw.word} for kw in keywords]
    if "selectedKeywords" in states:
        selected_keywords = selected_keywords_repo.find({"coding_context_id": workspace_id})
        response["selectedKeywords"] = [sk.keyword_id for sk in selected_keywords]
    if "keywordTable" in states:
        keyword_entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        response["keywordTable"] = [
            {
                "id": ke.id,
                "word": ke.word,
                "description": ke.description,
                "inclusion_criteria": ke.inclusion_criteria,
                "exclusion_criteria": ke.exclusion_criteria,
                "isMarked": bool(ke.is_marked)
            }
            for ke in keyword_entries
        ]

    
    if "sampledPostIds" in states:
        sampled_posts = selected_posts_repo.find({"dataset_id": workspace_id, "type": "sampled"})
        response["sampledPostIds"] = [sp.post_id for sp in sampled_posts]

    
    if "sampledPostResponse" in states:
        
        sampled_post_ids = response.get("sampledPostIds", [])
        if not sampled_post_ids and "sampledPostIds" not in states:
            sampled_posts = selected_posts_repo.find({"dataset_id": workspace_id, "type": "sampled"})
            sampled_post_ids = [sp.post_id for sp in sampled_posts]
        post_id_placeholders = ', '.join(['?'] * len(sampled_post_ids))
        qect_responses = qect_repo.execute_raw_query(f"""
            SELECT * FROM qect
            WHERE workspace_id = ?
            AND post_id IN ({post_id_placeholders})
            AND codebook_type = ?
        """, (
            workspace_id,
            *sampled_post_ids, 
            CodebookType.INITIAL.value
        ), True)
        response["sampledPostResponse"] = [
            {
                "id": qr["id"],
                "model": qr["model"],
                "quote": qr["quote"],
                "code": qr["code"],
                "explanation": qr["explanation"],
                "postId": qr["post_id"],
                "chatHistory": json.loads(qr["chat_history"]) if qr["chat_history"] else None,
                "isMarked": bool(qr["is_marked"]),
                "rangeMarker": json.loads(qr["range_marker"]) if qr["range_marker"] else None,
            }
            for qr in qect_responses
        ]

    if "unseenPostIds" in states:
        unseen_posts = selected_posts_repo.find({"dataset_id": workspace_id, "type": "unseen"})
        response["unseenPostIds"] = [up.post_id for up in unseen_posts]
    
    if "unseenPostResponse" in states:
        unseen_post_ids = response.get("unseenPostIds", [])
        if not unseen_post_ids and "unseenPostIds" not in states:
            unseen_posts = selected_posts_repo.find({"dataset_id": workspace_id, "type": "unseen"})
            unseen_post_ids = [up.post_id for up in unseen_posts]
        post_id_placeholders = ', '.join(['?'] * len(unseen_post_ids))
        qect_responses = qect_repo.execute_raw_query(f"""
            SELECT * FROM qect
            WHERE workspace_id = ?
            AND post_id IN ({post_id_placeholders})
            AND codebook_type = ?
        """, (
            workspace_id,
            *unseen_post_ids, 
            CodebookType.FINAL.value
        ), True)
        response["unseenPostResponse"] = [
            {
                "id": qr["id"],
                "model": qr["model"],
                "quote": qr["quote"],
                "code": qr["code"],
                "type": qr["response_type"],
                "explanation": qr["explanation"],
                "postId": qr["post_id"],
                "chatHistory": json.loads(qr["chat_history"]) if qr["chat_history"] else None,
                "isMarked": bool(qr["is_marked"]),
                "rangeMarker": json.loads(qr["range_marker"]) if qr["range_marker"] else None,
            }
            for qr in qect_responses
        ]

    if "initialCodebookTable" in states:
        initial_codebook_entries = initial_codebook_repo.find({"coding_context_id": workspace_id})
        response["initialCodebookTable"] = [
            {
                "id": entry.id,
                "code": entry.code,
                "definition": entry.definition,
            }
            for entry in initial_codebook_entries
        ]

    if "groupedCodes" in states:
        grouped_entries = grouped_codes_repo.find({"coding_context_id": workspace_id})
        grouped_codes_dict = defaultdict(list)
        higher_level_codes = {}
        for entry in grouped_entries: 
            grouped_codes_dict[entry.higher_level_code_id].append(entry.code)
            if entry.higher_level_code_id not in higher_level_codes:
                higher_level_codes[entry.higher_level_code_id] = entry.higher_level_code
        response["groupedCodes"] = [
            {"id": hid, "name": higher_level_codes[hid], "codes": list(filter(bool, codes))}
            for hid, codes in grouped_codes_dict.items()
        ]

    if "themes" in states:
        theme_entries = themes_repo.find({"coding_context_id": workspace_id})
        themes_dict = defaultdict(list)
        theme_names = {}
        for entry in theme_entries:
            themes_dict[entry["theme_id"]].append(entry["higher_level_code"])
            if entry["theme_id"] not in theme_names:
                theme_names[entry["theme_id"]] = entry["theme"]
        response["themes"] = [
            {"id": tid, "name": theme_names[tid], "codes": list(filter(bool, codes))}
            for tid, codes in themes_dict.items()
        ]

    print(f"Loaded coding context for workspace {workspace_id}: {response}")
    return response


collection_context_repo = CollectionContextRepository()

@router.post("/save-collection-context")
async def save_collection_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

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
        new_type = request_body.get("newType") or "reddit"
        collection_context.type = new_type
        collection_context_repo.update({"id": workspace_id}, {
            "type": new_type
        })
        return {"success": True, "type": new_type}

    elif operation_type == "setMetadataSource":
        source = request_body.get("source")
        if source not in ["folder", "url"]:
            raise HTTPException(status_code=400, detail="Invalid source")
        if collection_context.type == "interview" and source == "url":
            raise HTTPException(status_code=400, detail="Interview type only allows 'folder' source")
        metadata = json.loads(collection_context.metadata)
        metadata["source"] = source
        collection_context_repo.update({"id": workspace_id}, {"metadata": json.dumps(metadata)})
        return {"success": True, "source": source}

    elif operation_type == "setMetadataSubreddit":
        if collection_context.type != "reddit":
            raise HTTPException(status_code=400, detail="Subreddit can only be set for reddit type")
        subreddit = request_body.get("subreddit")
        metadata = json.loads(collection_context.metadata)
        metadata["subreddit"] = subreddit
        collection_context_repo.update({"id": workspace_id}, {"metadata": json.dumps(metadata)})
        return {"success": True, "subreddit": subreddit}

    elif operation_type == "setModeInput":
        mode_input = request_body.get("modeInput")
        collection_context_repo.update({"id": workspace_id}, {"mode_input": mode_input})
        return {"success": True, "modeInput": mode_input}

    elif operation_type == "setSelectedData":
        selected_data = request_body.get("selectedData")
        print(f"Selected data: {selected_data}")
        if not isinstance(selected_data, list):
            raise HTTPException(status_code=400, detail="selectedData must be a list")
        selected_posts_repo.delete({"dataset_id": workspace_id})
        selected_posts_repo.insert_batch(
            [SelectedPostId(dataset_id=workspace_id, post_id=post_id) for post_id in selected_data],
        )
        return {"success": True, "selectedData": selected_data}

    elif operation_type == "setDataFilters":
        data_filters = request_body.get("dataFilters")
        print(f"Data filters: {data_filters}")
        if not isinstance(data_filters, dict):
            raise HTTPException(status_code=400, detail="dataFilters must be a dictionary")
        collection_context_repo.update({"id": workspace_id}, {"data_filters": json.dumps(data_filters)})
        return {"success": True, "dataFilters": data_filters}

    elif operation_type == "setIsLocked":
        is_locked = request_body.get("isLocked")
        print(f"Is locked: {is_locked}")
        collection_context_repo.update({"id": workspace_id}, {"is_locked": bool(is_locked)})
        return {"success": True, "isLocked": is_locked}

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
        selected_posts_repo.delete({"dataset_id": workspace_id})
        return {"success": True}

    else:
        print(f"Unknown operation type: {operation_type}")
        return {"success": False}

@router.post("/load-collection-context")
async def load_collection_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    states = request_body.get("states", [])
    if not states:
        states = ["type", "metadata", "dataset", "modeInput", "selectedData", "dataFilters", "isLocked"]

    collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
    if not collection_context:
        collection_context_repo.insert(CollectionContext(id=workspace_id))
        return {}

    response = {}
    if "type" in states:
        response["type"] = collection_context.type
    if "metadata" in states:
        response["metadata"] = collection_context.metadata
    if "modeInput" in states:
        response["modeInput"] = collection_context.mode_input
    if "selectedData" in states:
        response["selectedData"] = list(map(lambda x: x["post_id"], selected_posts_repo.find({"dataset_id": workspace_id}, columns=["post_id"], map_to_model=False))) or []
    if "dataFilters" in states:
        response["dataFilters"] = json.loads(collection_context.data_filters or "{}")
    if "isLocked" in states:
        response["isLocked"] = bool(collection_context.is_locked)

    return response


manual_post_state_repo = ManualPostStatesRepository()
manual_codebook_repo = ManualCodebookEntriesRepository()

@router.post("/save-manual-coding-context")
async def save_manual_coding_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    operation_type = request_body.get("type")
    if not operation_type:
        raise HTTPException(status_code=400, detail="Operation type is required")

    if operation_type == "addPostIds":
        new_post_ids = request_body.get("newPostIds", [])
        for post_id in new_post_ids:
            existing = manual_post_state_repo.find_one({"workspace_id": workspace_id, "post_id": post_id}, fail_silently=True)
            if not existing:
                manual_post_state_repo.insert(ManualPostState(workspace_id=workspace_id, post_id=post_id, is_marked=False))
        post_states = manual_post_state_repo.find({"workspace_id": workspace_id})
        return {"success": True, "postStates": {ps.post_id: bool(ps.is_marked) for ps in post_states}}

    elif operation_type == "updatePostState":
        post_id = request_body.get("postId")
        state = request_body.get("state")
        if post_id is None or state is None:
            raise HTTPException(status_code=400, detail="postId and state are required")
        manual_post_state_repo.update({"workspace_id": workspace_id, "post_id": post_id}, {"is_marked": bool(state)})
        post_states = manual_post_state_repo.find({"workspace_id": workspace_id})
        return {"success": True, "postStates": {ps.post_id: ps.is_marked for ps in post_states}}

    elif operation_type == "dispatchManualCodingResponses":
        action = request_body.get("action")
        if not action or "type" not in action:
            raise HTTPException(status_code=400, detail="Invalid action")
        process_manual_coding_responses_action(workspace_id, action)
        responses = qect_repo.find({"workspace_id": workspace_id, "codebook_type": "manual"})
        return {"success": True, "manualCodingResponses": [response.to_dict() for response in responses]}

    elif operation_type == "setCodebook":
        return {"success": True, "codebook": request_body.get("codebook", {})}

    elif operation_type == "updateContext":
        updates = request_body.get("updates", {})
        if "postStates" in updates:
            new_post_states = updates["postStates"]
            manual_post_state_repo.delete({"workspace_id": workspace_id})
            for post_id, state in new_post_states.items():
                manual_post_state_repo.insert(ManualPostState(workspace_id=workspace_id, post_id=post_id, state=state))
        if "codebook" in updates:
            new_codebook = updates["codebook"]
            manual_codebook_repo.delete({"workspace_id": workspace_id})
            for code, description in new_codebook.items():
                manual_codebook_repo.insert(ManualCodebookEntry(workspace_id=workspace_id, code=code, description=description))
        post_states = manual_post_state_repo.find({"workspace_id": workspace_id})
        codebook_entries = manual_codebook_repo.find({"workspace_id": workspace_id})
        responses = qect_repo.find({"workspace_id": workspace_id, "codebook_type": "manual"})
        return {
            "success": True,
            "postStates": {ps.post_id: ps.is_marked for ps in post_states},
            "codebook": {entry.code: entry.definition for entry in codebook_entries}
        }

    elif operation_type == "resetContext":
        manual_post_state_repo.delete({"workspace_id": workspace_id})
        manual_codebook_repo.delete({"workspace_id": workspace_id})
        qect_repo.delete({"workspace_id": workspace_id, "codebook_type": "manual"})
        return {"success": True}

    else:
        raise HTTPException(status_code=400, detail="Invalid operation type")

@router.post("/load-manual-coding-context")
async def load_manual_coding_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    states = request_body.get("states", [])
    if not states:
        states = ["postStates", "codebook"]

    response = {}

    if "postStates" in states:
        post_states = manual_post_state_repo.find({"workspace_id": workspace_id})
        response["postStates"] = {ps.post_id: bool(ps.is_marked) for ps in post_states}

    if "codebook" in states:
        codebook_entries = manual_codebook_repo.find({"workspace_id": workspace_id})
        response["codebook"] = {entry.code: entry.definition for entry in codebook_entries}
    return response

@router.post("/reset-context-data")
async def reset_context_data_endpoint(
    request: Request,
    request_body: Any = Body(...),
):
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

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
        keywords_repo.delete({"coding_context_id": workspace_id})
        selected_keywords_repo.delete({"coding_context_id": workspace_id})
        keyword_entries_repo.delete({"coding_context_id": workspace_id})
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
        selected_posts_repo.delete({"dataset_id": workspace_id})
        return {"success": True, "message": "All context data reset successfully"}
    
    if page == "context":
        coding_context_repo.update(
            {"id": workspace_id},
            {"main_topic": None, "additional_info": None}
        )
        context_files_repo.delete({"coding_context_id": workspace_id})
        research_question_repo.delete({"coding_context_id": workspace_id})
    elif page ==  "related_concepts":
        keywords_repo.delete({"coding_context_id": workspace_id})
        selected_keywords_repo.delete({"coding_context_id": workspace_id})
    elif page == "concept_outline":
        keyword_entries_repo.delete({"coding_context_id": workspace_id})
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
            "codebook_type": CodebookType.FINAL.value
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
        selected_posts_repo.delete({"dataset_id": workspace_id})
        collection_context_repo.update(
            {"id": workspace_id},
            {"data_filters": json.dumps({}), "is_locked": False}
        )
    elif page == "manual_coding":
        manual_codebook_repo.delete({"workspace_id": workspace_id})
        manual_post_state_repo.update({"workspace_id": workspace_id}, {"is_marked": False})
        qect_repo.delete({"workspace_id": workspace_id, "codebook_type": "manual"})
    else:
        raise HTTPException(status_code=400, detail="Invalid page")
    
    return {"success": True, "message": f"Context data for {page} reset successfully"}


@router.post("/check-data-existence")
async def check_data_existence(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, bool]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    page = request_body.get("page")
    if not page:
        raise HTTPException(status_code=400, detail="page is required")
    
    print(f"Checking data existence for workspace {workspace_id} on page {page}")

    states = PAGE_TO_STATES.get(FRONTEND_PAGE_MAPPER.get(page), [])
    print(f"States to check: {states}")
    if not states:
        return {"exists": False}

    exists = False

    for state in states:
        if state == "contextFiles":
            exists = exists or context_files_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Context files exist: {exists}, context file")
        elif state == "mainTopic":
            coding_context = coding_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists = exists or (coding_context and coding_context.get("main_topic") is not None)
            print(f"Main topic exists: {exists}, main topic")
        elif state == "additionalInfo":
            coding_context = coding_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists = exists or (coding_context and coding_context.get("additional_info") is not None)
            print(f"Additional info exists: {exists}, additional info")
        elif state == "researchQuestions":
            exists = exists or research_question_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Research questions exist: {exists}, research questions")
        elif state == "keywords":
            exists = exists or keywords_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Keywords exist: {exists}, keywords")
        elif state == "selectedKeywords":
            exists = exists or selected_keywords_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Selected keywords exist: {exists}, selected keywords")
        elif state == "keywordTable":
            exists = exists or keyword_entries_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Keyword table exist: {exists}, keyword table")
        elif state == "sampledPostResponse":
            exists = exists or qect_repo.count({
                "workspace_id": workspace_id,
                "codebook_type": CodebookType.INITIAL.value
            }) > 0
            print(f"Sampled post response exist: {exists}, sampled post response")
        elif state == "sampledPostIds":
            exists = exists or selected_posts_repo.count({
                "dataset_id": workspace_id,
                "type": "sampled"
            }) > 0
            print(f"Sampled post ids exist: {exists}, sampled post ids")
        elif state == "unseenPostIds":
            exists = exists or selected_posts_repo.count({
                "dataset_id": workspace_id,
                "type": "unseen"
            }) > 0
            print(f"Unseen post ids exist: {exists}, unseen post ids")
        elif state == "unseenPostResponse":
            exists = exists or qect_repo.count({
                "workspace_id": workspace_id,
                "codebook_type": CodebookType.FINAL.value
            }) > 0
            print(f"Unseen post response exist: {exists}, unseen post response")
        elif state == "initialCodebookTable":
            exists = exists or initial_codebook_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Initial codebook table exist: {exists}, initial codebook table")
        elif state == "groupedCodes":
            exists = exists or grouped_codes_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Grouped codes exist: {exists}, grouped codes")
        elif state == "unplacedSubCodes":
            exists = exists or grouped_codes_repo.count({
                "coding_context_id": workspace_id,
                "higher_level_code": None
            }) > 0
            print(f"Unplaced subcodes exist: {exists}, unplaced subcodes")
        elif state == "themes":
            exists = exists or themes_repo.count({"coding_context_id": workspace_id}) > 0
            print(f"Themes exist: {exists}, themes")
        elif state == "unplacedCodes":
            exists = exists or themes_repo.count({
                "coding_context_id": workspace_id,
                "theme": None
            }) > 0
            print(f"Unplaced codes exist: {exists}, unplaced codes")
        elif state == "type":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists = exists or (collection_context and collection_context.get("type") is not None)
            print(f"Type exist: {exists}, type")
        elif state == "modeInput":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists = exists or (collection_context and collection_context.get("mode_input") is not None)
            print(f"Mode input exist: {exists}, mode input")
        elif state == "selectedData":
            exists = exists or selected_posts_repo.count({"dataset_id": workspace_id}) > 0
            print(f"Selected data exist: {exists}, selected data")
        elif state == "dataFilters":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists = exists or (collection_context and (collection_context.get("data_filters") and collection_context.get("data_filters") != json.dumps({})))
            print(f"Data filters exist: {exists}, data filters")
        elif state == "isLocked":
            collection_context = collection_context_repo.find_one({"id": workspace_id}, fail_silently=True)
            exists = exists or (collection_context and collection_context.get("is_locked"))
            print(f"Is locked exist: {exists}, is locked")
        elif state == "postStates":
            exists = exists or manual_post_state_repo.count({"workspace_id": workspace_id}) > 0
            print(f"Post states exist: {exists}, post states")
        elif state == "codebook":
            exists = exists or manual_codebook_repo.count({"workspace_id": workspace_id}) > 0
            print(f"Codebook exist: {exists}, codebook")
        elif state == "manualCodingResponses":
            exists = exists or qect_repo.count({"workspace_id": workspace_id, "codebook_type": "manual"}) > 0
            print(f"Manual coding responses exist: {exists}, manual coding responses")
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


@router.post("/load-state")
async def load_state_endpoint(request: LoadStateRequest):
    try:
        result = load_state(request)
        
        return {"success": True, "data": result.get("data")}
    except Exception as e:
        print(f"Error loading state: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@router.delete("/delete-state")
async def delete_state_endpoint(request: LoadStateRequest):
    try:
        print("Deleting state", request.workspace_id, request.user_email)
        delete_state(request)
        return {"success": True, "message": "State deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    



@router.post("/export-workspace")
async def export_workspace_endpoint(request: LoadStateRequest):
    workspace_id = request.workspace_id
    user_email = request.user_email
    if workspace_id is None or workspace_id == "" or user_email is None or user_email == "":
        raise HTTPException(status_code=400, detail="workspace_id and user_email are required")
    try:
        zip_file, temp_folder = export_workspace(workspace_id, user_email) 
        return FileResponse(
            zip_file,
            media_type="application/zip",
            filename="exported_workspace.zip"
        )

    except Exception as e:
        print(f"Error exporting workspace: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while exporting the workspace")

    finally:
        if os.path.exists(temp_folder):
            shutil.rmtree(temp_folder)




@router.post("/import-workspace")
async def import_workspace_endpoint(
    user_email: str = Form(...),
    file: UploadFile = File(...)
):
        if not file.filename.endswith(".zip"):
            raise HTTPException(status_code=400, detail="Uploaded file is not a ZIP file")

        workspace_id, workspace_name, workspace_description = import_workspace(
            user_email, file
        )
        return {
            "success": True,
            "message": "Workspace imported successfully",
            "workspace": {
                "id": workspace_id,
                "name": workspace_name,
                "description": workspace_description,
            }
        }



