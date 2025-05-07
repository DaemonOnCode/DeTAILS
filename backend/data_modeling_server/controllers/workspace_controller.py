import json
import os
from uuid import uuid4

from constants import STUDY_DATABASE_PATH,  CONTEXT_FILES_DIR
from database import WorkspacesRepository
from database.state_dump_table import StateDumpsRepository
from models import Workspace
from models.table_dataclasses import StateDump

workspace_repo = WorkspacesRepository()
state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

def create_workspace(data):
    workspace_id = str(uuid4())
    print("Created workspace ID: ", workspace_id)

    workspace_repo.insert(Workspace(id=workspace_id, name=data.name, description= data.description, user_email=data.user_email))

    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "workspace_id": workspace_id,
            }),
            context=json.dumps({
                "function": "create_workspace",
            }),
        )
    )

    return workspace_repo.find_one({
        "id": workspace_id
    }).to_dict()

def get_workspaces(user_email: str):
    return workspace_repo.find({"user_email": user_email})

def update_workspace(data):
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "workspace_id": data.id,
                "name": data.name,
                "description": data.description
            }),
            context=json.dumps({
                "function": "update_workspace",
            }),
        )
    )
    workspace_repo.update(
        {"id": data.id}, 
        {
            **({"name": data.name} if data.name else {}), 
            **({"description": data.description} if data.description else {})
        }
    )

def delete_workspace(workspace_id: str):
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "workspace_id": workspace_id,
            }),
            context=json.dumps({
                "function": "delete_workspace",
            }),
        )
    )
    workspace_repo.delete({"id": workspace_id})
    for file in os.listdir(CONTEXT_FILES_DIR):
        file_path = os.path.join(CONTEXT_FILES_DIR, file)
        if os.path.isfile(file_path) and file.startswith(workspace_id):
            os.remove(file_path)


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