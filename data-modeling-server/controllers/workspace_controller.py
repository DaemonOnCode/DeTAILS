from uuid import uuid4

from utils.db_helpers import execute_query

def create_workspace(data):
    workspace_id = str(uuid4())
    print("Created workspace ID: ", workspace_id)
    execute_query(
        "INSERT INTO workspaces (id, name, description, user_email) VALUES (?, ?, ?, ?)",
        (workspace_id, data.name, data.description, data.user_email),
    )
    return workspace_id

def get_workspaces(user_email: str):
    return execute_query(
        "SELECT * FROM workspaces WHERE user_email = ?", (user_email,), keys=True
    )

def update_workspace(data):
    updates = []
    params = []
    if data.name:
        updates.append("name = ?")
        params.append(data.name)
    if data.description:
        updates.append("description = ?")
        params.append(data.description)
    params.append(data.id)
    query = f"UPDATE workspaces SET {', '.join(updates)} WHERE id = ?"
    execute_query(query, tuple(params))

def delete_workspace(workspace_id: str):
    execute_query("DELETE FROM workspaces WHERE id = ?", (workspace_id,))


def create_temp_workspace(user_email: str):
    existing_workspace = execute_query(
        "SELECT id FROM workspaces WHERE user_email = ? AND name = ?",
        (user_email, "Temporary Workspace"),
        keys=True,
    )
    
    if existing_workspace:
        # Return the existing temporary workspace ID
        return {"message": "Temporary workspace already exists.", "id": existing_workspace[0]["id"]}

    # Create a new temporary workspace
    workspace_id = str(uuid4())
    execute_query(
        "INSERT INTO workspaces (id, name, description, user_email) VALUES (?, ?, ?, ?)",
        (workspace_id, "Temporary Workspace", "This is a temporary workspace.", user_email),
    )

    return workspace_id

def upgrade_workspace_from_temp(workspace_id: str, new_name: str):
    execute_query(
        "UPDATE workspaces SET name = ?, description = 'Upgraded workspace' WHERE id = ?",
        (new_name, workspace_id),
    )