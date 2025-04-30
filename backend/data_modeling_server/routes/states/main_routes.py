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



