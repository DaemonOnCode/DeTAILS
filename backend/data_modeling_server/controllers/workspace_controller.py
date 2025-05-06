from uuid import uuid4

from database import WorkspacesRepository
from models import Workspace

workspace_repo = WorkspacesRepository()

def create_workspace(data):
    workspace_id = str(uuid4())
    print("Created workspace ID: ", workspace_id)

    workspace_repo.insert(Workspace(id=workspace_id, name=data.name, description= data.description, user_email=data.user_email))

    return workspace_repo.find_one({
        "id": workspace_id
    }).to_dict()

def get_workspaces(user_email: str):
    return workspace_repo.find({"user_email": user_email})

def update_workspace(data):
    workspace_repo.update(
        {"id": data.id}, 
        {
            **({"name": data.name} if data.name else {}), 
            **({"description": data.description} if data.description else {})
        }
    )

def delete_workspace(workspace_id: str):
    workspace_repo.delete({"id": workspace_id})


def create_temp_workspace(user_email: str):
    try:
        existing_workspace = workspace_repo.find_one(
            {
                "user_email": user_email,
                "name": "Temporary Workspace"
            }
        )
    except Exception as e:
        print(e)
        existing_workspace = None
    if existing_workspace:
        return {"message": "Temporary workspace already exists.", "id": existing_workspace.id}

    workspace_id = str(uuid4())
    workspace_repo.insert(Workspace(
        id=workspace_id,
        name="Temporary Workspace",
        description= "This is a temporary workspace.",
        user_email=user_email
    ))

    return workspace_id

def upgrade_workspace_from_temp(workspace_id: str, new_name: str):
    workspace_repo.update({"id": workspace_id}, {
        "name":new_name,
        "description": 'Upgraded from temporary workspace'
    })