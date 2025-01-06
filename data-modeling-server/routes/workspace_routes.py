from typing import List
from fastapi import APIRouter, HTTPException

from controllers.workspace_controller import create_temp_workspace, create_workspace, delete_workspace, get_workspaces, update_workspace, upgrade_workspace_from_temp
from models.workspace_model import WorkspaceCreateRequest, WorkspaceUpdateRequest


router = APIRouter()

# Routes
@router.post("/create-workspace")
async def create_workspace_endpoint(request: WorkspaceCreateRequest):
    """
    Create a new workspace and associate it with the user's email.
    """
    try:
        workspace_id = create_workspace(request)
        return {"message": "Workspace created successfully!", "id": workspace_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get-workspaces", response_model=List[dict])
async def get_workspaces_endpoint(user_email: str):
    """
    Retrieve all workspaces associated with the user's email.
    """
    try:
        workspaces = get_workspaces(user_email)
        return workspaces
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-workspace")
async def update_workspace_endpoint(request: WorkspaceUpdateRequest):
    """
    Update a workspace's name or description.
    """
    try:
        update_workspace(request)
        return {"message": "Workspace updated successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/delete-workspace/{workspace_id}")
async def delete_workspace_endpoint(workspace_id: str):
    """
    Delete a workspace by its ID.
    """
    try:
        delete_workspace(workspace_id)
        return {"message": "Workspace deleted successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-temp-workspace")
async def create_temp_workspace_endpoint(user_email: str):
    """
    Create a temporary workspace for the user if it doesn't already exist.
    """
    try:
        workspace_id = create_temp_workspace(user_email)
        return {"message": "Temporary workspace created successfully!", "id": workspace_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upgrade-workspace-from-temp")
async def upgrade_workspace_from_temp_endpoint(workspace_id: str, new_name: str):
    """
    Upgrade a temporary workspace to a permanent one.
    """
    try:
        upgrade_workspace_from_temp(workspace_id, new_name)
        return {"message": "Workspace upgraded successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
