from datetime import datetime
import os
import shutil
from typing import Any, Dict, List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Body, Request
from fastapi.responses import FileResponse

from controllers.state_controller import delete_state, export_workspace, import_workspace, load_state, save_state
from database.coding_context_table import CodingContextRepository
from database.context_file_table import ContextFilesRepository
from database.keyword_table import KeywordsRepository
from database.research_question_table import ResearchQuestionsRepository
from database.selected_keywords_table import SelectedKeywordsRepository
from models.state_models import LoadStateRequest, SaveStateRequest
from models.table_dataclasses import CodingContext, ContextFile, Keyword, ResearchQuestion, SelectedKeyword


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

@router.post("/save-coding-context")
async def save_coding_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    # Get workspace ID from headers
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    # Ensure CodingContext exists
    try:
        coding_context = coding_context_repo.find_one({"id": workspace_id})
    except:
        coding_context = CodingContext(id=workspace_id)
        coding_context_repo.insert(coding_context)

    # Get operation type
    operation_type = request_body.get("type")
    if not operation_type:
        raise HTTPException(status_code=400, detail="Operation type is required")

    # Handle operations
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

    # New operation: setKeywords
    elif operation_type == "setKeywords":
        keywords = request_body.get("keywords")
        if not isinstance(keywords, list):
            raise HTTPException(status_code=400, detail="keywords must be a list")
        keywords_repo.delete({"coding_context_id": workspace_id})  # Clear existing keywords
        for kw in keywords:
            keyword = Keyword(coding_context_id=workspace_id, word=kw["word"])
            keywords_repo.insert(keyword)
        return {"success": True, "keywords": keywords}

    # New operation: setSelectedKeywords
    elif operation_type == "setSelectedKeywords":
        selected_keywords = request_body.get("selectedKeywords")
        if not isinstance(selected_keywords, list):
            raise HTTPException(status_code=400, detail="selectedKeywords must be a list")
        selected_keywords_repo.delete({"coding_context_id": workspace_id})  # Clear existing selected keywords
        for sk in selected_keywords:
            skw = SelectedKeyword(coding_context_id=workspace_id, keyword_id=sk)
            selected_keywords_repo.insert(skw)
        return {"success": True, "selectedKeywords": selected_keywords}

    elif operation_type == "resetContext":
        context_files_repo.delete({"coding_context_id": workspace_id})
        research_question_repo.delete({"coding_context_id": workspace_id})
        keywords_repo.delete({"coding_context_id": workspace_id})  # Clear keywords
        selected_keywords_repo.delete({"coding_context_id": workspace_id})  # Clear selected keywords
        coding_context_repo.update(
            {"id": workspace_id},
            {"main_topic": None, "additional_info": None, "updated_at": datetime.now()}
        )
        return {"success": True, "message": "Context reset successfully"}

    else:
        raise HTTPException(status_code=400, detail="Invalid operation type")

@router.post("/load-coding-context")
async def load_coding_context(request: Request, request_body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """
    Load specific states of the coding context for a given workspace.

    Args:
        request_body (Dict[str, Any]): JSON body containing:
            - states (List[str], optional): List of state names to retrieve 
              (e.g., ["mainTopic", "keywords"]). If omitted, all states are returned.

    Returns:
        Dict[str, Any]: A dictionary containing the requested states.
    """
    # Extract workspaceId and states from the request
    workspace_id = request.headers.get("x-workspace-id")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    states: List[str] = request_body.get("states", [])
    if not states:
        states = ["mainTopic", "additionalInfo", "contextFiles", "researchQuestions", "keywords", "selectedKeywords"]

    # Initialize the response dictionary
    response: Dict[str, Any] = {}

    # Fetch CodingContext only if needed
    try:
        if any(state in ["mainTopic", "additionalInfo"] for state in states):
            coding_context = coding_context_repo.find_one({"id": workspace_id})
        else:
            coding_context = None
    except Exception:
        coding_context = None

    # Populate the response with requested states
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

    return response

@router.post("/load-state")
async def load_state_endpoint(request: LoadStateRequest):
    try:
        result = load_state(request)
        # print("Loaded state", result)
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
        # Return the ZIP file
        return FileResponse(
            zip_file,
            media_type="application/zip",
            filename="exported_workspace.zip"
        )

    except Exception as e:
        # Log the error and return an appropriate HTTP error
        print(f"Error exporting workspace: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while exporting the workspace")

    finally:
        # Clean up temporary files and folder
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
    # try:
        # Create a temporary directory for file extraction
        
        # Clean up temporary directory
        # shutil.rmtree(temp_dir, ignore_errors=True)
        # print(f"Cleaned up temporary directory: {temp_dir}")

        # Return the new workspace details
        return {
            "success": True,
            "message": "Workspace imported successfully",
            "workspace": {
                "id": workspace_id,
                "name": workspace_name,
                "description": workspace_description,
            }
        }

    # except Exception as e:
    #     if os.path.exists(temp_dir):
    #         shutil.rmtree(temp_dir)
    #     print(f"Error importing workspace: {e}")
    #     raise HTTPException(status_code=500, detail=f"Error importing workspace: {str(e)}")


