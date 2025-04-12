from typing import List
from fastapi import APIRouter

from controllers.workspace_controller import create_temp_workspace, create_workspace, delete_workspace, get_workspaces, update_workspace, upgrade_workspace_from_temp
from models.workspace_model import WorkspaceCreateRequest, WorkspaceUpdateRequest


router = APIRouter()

# Routes
@router.post("/create-workspace")
async def create_workspace_endpoint(request: WorkspaceCreateRequest):
    """
    Create a new workspace and associate it with the user's email.
    """
    workspace_details = create_workspace(request)
    print("Workspace ID: ", workspace_details, "Create workspace")
    return {"message": "Workspace created successfully!", **workspace_details}

@router.get("/get-workspaces", response_model=List[dict])
async def get_workspaces_endpoint(user_email: str):
    """
    Retrieve all workspaces associated with the user's email.
    """
    workspaces = get_workspaces(user_email)
    return [workspace.to_dict() for workspace in workspaces]


@router.put("/update-workspace")
async def update_workspace_endpoint(request: WorkspaceUpdateRequest):
    """
    Update a workspace's name or description.
    """
    update_workspace(request)
    return {"message": "Workspace updated successfully!"}



@router.delete("/delete-workspace/{workspace_id}")
async def delete_workspace_endpoint(workspace_id: str):
    """
    Delete a workspace by its ID.
    """
    delete_workspace(workspace_id)
    return {"message": "Workspace deleted successfully!"}

@router.post("/create-temp-workspace")
async def create_temp_workspace_endpoint(user_email: str):
    """
    Create a temporary workspace for the user if it doesn't already exist.
    """
    workspace_id = create_temp_workspace(user_email)
    return {"message": "Temporary workspace created successfully!", "id": workspace_id}


@router.post("/upgrade-workspace-from-temp")
async def upgrade_workspace_from_temp_endpoint(workspace_id: str, new_name: str):
    """
    Upgrade a temporary workspace to a permanent one.
    """
    upgrade_workspace_from_temp(workspace_id, new_name)
    return {"message": "Workspace upgraded successfully!"}
