import sqlite3
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from constants import DATABASE_PATH


router = APIRouter()

class WorkspaceCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    user_email: str

class WorkspaceUpdateRequest(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None

def initialize_database():
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()

        # Create workspaces table with user_email
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            user_email TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        conn.commit()


initialize_database()

# Helper function
def run_query(query: str, params: tuple = ()):
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()

def run_query_with_columns(query: str, params: tuple = ()) -> List[dict]:
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

# Routes
@router.post("/create-workspace")
async def create_workspace(request: WorkspaceCreateRequest):
    """
    Create a new workspace and associate it with the user's email.
    """
    workspace_id = str(uuid4())
    user_email = request.user_email
    try:
        run_query(
            "INSERT INTO workspaces (id, name, description, user_email) VALUES (?, ?, ?, ?)",
            (workspace_id, request.name, request.description, user_email),
        )
        return {"message": "Workspace created successfully!", "id": workspace_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/get-workspaces", response_model=List[dict])
async def get_workspaces(user_email: str):
    """
    Retrieve all workspaces associated with the user's email.
    """
    try:
        workspaces = run_query_with_columns(
            "SELECT * FROM workspaces WHERE user_email = ?", (user_email,)
        )
        print(workspaces)
        return workspaces
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-workspace")
async def update_workspace(request: WorkspaceUpdateRequest):
    """
    Update a workspace's name or description.
    """
    try:
        updates = []
        params = []
        if request.name:
            updates.append("name = ?")
            params.append(request.name)
        if request.description:
            updates.append("description = ?")
            params.append(request.description)

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update.")

        params.append(request.id)
        query = f"UPDATE workspaces SET {', '.join(updates)} WHERE id = ?"
        run_query(query, tuple(params))
        return {"message": "Workspace updated successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.delete("/delete-workspace/{workspace_id}")
async def delete_workspace(workspace_id: str):
    """
    Delete a workspace by its ID.
    """
    try:
        run_query("DELETE FROM workspaces WHERE id = ?", (workspace_id,))
        return {"message": "Workspace deleted successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-temp-workspace")
async def create_temp_workspace(user_email: str):
    """
    Create a temporary workspace for the user if it doesn't already exist.
    """
    try:
        # Check if a temporary workspace already exists for the user
        existing_workspace = run_query_with_columns(
            "SELECT id FROM workspaces WHERE user_email = ? AND name = ?",
            (user_email, "Temporary Workspace"),
        )
        
        if existing_workspace:
            # Return the existing temporary workspace ID
            return {"message": "Temporary workspace already exists.", "id": existing_workspace[0]["id"]}

        # Create a new temporary workspace
        workspace_id = str(uuid4())
        run_query(
            "INSERT INTO workspaces (id, name, description, user_email) VALUES (?, ?, ?, ?)",
            (workspace_id, "Temporary Workspace", "This is a temporary workspace.", user_email),
        )
        return {"message": "Temporary workspace created successfully!", "id": workspace_id}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





@router.post("/upgrade-workspace-from-temp")
async def upgrade_workspace_from_temp(workspace_id: str, new_name: str):
    """
    Upgrade a temporary workspace to a permanent one.
    """
    try:
        run_query(
            "UPDATE workspaces SET name = ?, description = 'Upgraded workspace' WHERE id = ?",
            (new_name, workspace_id),
        )
        return {"message": "Workspace upgraded successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
