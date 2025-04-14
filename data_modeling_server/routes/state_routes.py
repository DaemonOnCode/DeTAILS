from datetime import datetime
import json
import os
import shutil
from typing import Any, Dict, List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Body, Request
from fastapi.responses import FileResponse

from controllers.state_controller import delete_state, export_workspace, import_workspace, load_state, save_state
from database.coding_context_table import CodingContextRepository
from database.context_file_table import ContextFilesRepository
from database.initial_codebook_table import InitialCodebookEntriesRepository
from database.keyword_entry_table import KeywordEntriesRepository
from database.keyword_table import KeywordsRepository
from database.qect_table import QectRepository
from database.research_question_table import ResearchQuestionsRepository
from database.selected_keywords_table import SelectedKeywordsRepository
from database.selected_post_ids_table import SelectedPostIdsRepository
from models.state_models import LoadStateRequest, SaveStateRequest
from models.table_dataclasses import CodebookType, CodingContext, ContextFile, GenerationType, Keyword, ResearchQuestion, SelectedKeyword, SelectedPostId
from utils.reducers import process_initial_codebook_table_action, process_keyword_table_action, process_sampled_post_response_action, process_unseen_post_response_action


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

@router.post("/save-coding-context")
async def save_coding_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    
    try:
        coding_context = coding_context_repo.find_one({"id": workspace_id})
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
        coding_context_repo.update({"id": workspace_id}, {"main_topic": main_topic, "updated_at": datetime.now()})
        return {"success": True, "mainTopic": main_topic}

    elif operation_type == "setAdditionalInfo":
        additional_info = request_body.get("additionalInfo")
        if additional_info is None:
            raise HTTPException(status_code=400, detail="additionalInfo is required")
        coding_context_repo.update({"id": workspace_id}, {"additional_info": additional_info, "updated_at": datetime.now()})
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
            {"main_topic": None, "additional_info": None, "updated_at": datetime.now()}
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
        return {"success": True, "sampledPostResponse": [response.to_dict() for response in sampled_responses]}
    
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
            "codebook_type": CodebookType.DEDUCTIVE.value,
        })
        return {"success": True, "unseenPostResponse": [response.to_dict() for response in unseen_responses]}

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
                "chatHistory": json.loads(qr["chat_history"]) if qr["chat_history"] else [],
                "isMarked": qr["is_marked"]
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
            CodebookType.DEDUCTIVE.value
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
                "chatHistory": json.loads(qr["chat_history"]) if qr["chat_history"] else [],
                "isMarked": qr["is_marked"]
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

    return response

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



