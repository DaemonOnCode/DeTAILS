import os
import shutil
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from controllers.state_controller import delete_state, export_workspace, import_workspace, load_state, save_state
from models.state_models import LoadStateRequest, SaveStateRequest

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


@router.post("/restore-last-saved")
async def restore_last_saved_endpoint(request: LoadStateRequest):
    try:
        result = load_state(request, restore_last_saved=True)
        return {"success": True, "data": result.get("data")}
    except Exception as e:
        print(f"Error restoring last saved state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


