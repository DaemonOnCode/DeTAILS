from datetime import datetime
import glob
import json
import os
import shutil
import sqlite3

import time
from typing import Any, Dict, List
from uuid import uuid4
from zipfile import ZipFile
from chromadb import HttpClient
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from constants import DATABASE_PATH
from controllers.state_controller import delete_state, load_state, save_state
from decorators.execution_time_logger import log_execution_time
from models.state_models import CodingContext, CollectionContext, LoadStateRequest, ModelingContext, SaveStateRequest
from utils.chroma_export import chroma_export_cli, chroma_import


router = APIRouter()

# Helper function
def run_query(query: str, params: tuple = ()):
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        print(f"Executed query: {query}", params, cursor.lastrowid)
        conn.commit()

def run_query_with_columns(query: str, params: tuple = ()) -> List[dict]:
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

@router.post("/save-state")
@log_execution_time()
def save_state_endpoint(request: SaveStateRequest):
    if request.workspace_id is None or request.workspace_id == "":
        raise HTTPException(status_code=400, detail="workspace_id is required")
    try:
        save_state(request)
        return {"success": True, "message": "State saved successfully"}

    except Exception as e:
        print(f"Error saving state: {e}")
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/load-state")
@log_execution_time()
def load_state_endpoint(request: LoadStateRequest):
    try:
        result = load_state(request)
        # print("Loaded state", result)
        return {"success": True, "data": result.get("data")}
    except Exception as e:
        print(f"Error loading state: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

@router.delete("/delete-state")
@log_execution_time()
def delete_state_endpoint(request: LoadStateRequest):
    try:
        print("Deleting state", request.workspace_id, request.user_email)
        delete_state(request)
        return {"success": True, "message": "State deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

def find_file_with_time(folder_path: str, dataset_id: str, file_name: str) -> str:
    # Construct the search pattern
    search_pattern = os.path.join(folder_path, f"{dataset_id}_*_{file_name}")

    # Find files matching the pattern
    matching_files = glob.glob(search_pattern)

    if not matching_files:
        return None
    
    # Return the first matching file (if multiple files, handle based on requirements)
    return matching_files[0]

@router.post("/export-workspace")
@log_execution_time()
def export_workspace(request: LoadStateRequest):
    workspace_id = request.workspace_id
    user_email = request.user_email
    if workspace_id is None or workspace_id == "" or user_email is None or user_email == "":
        raise HTTPException(status_code=400, detail="workspace_id and user_email are required")
    temp_folder = f"/export_temp/{workspace_id}"
    os.makedirs(temp_folder, exist_ok=True)
    try:

        # Fetch workspace state from the database
        state = run_query_with_columns(
            """
            SELECT 
                ws.*, 
                w.name AS workspace_name, 
                w.description AS workspace_description
            FROM workspace_states ws
            INNER JOIN workspaces w ON ws.workspace_id = w.id
            WHERE ws.workspace_id = ? AND ws.user_email = ?
            """,
            (workspace_id, user_email),
        )



        if not state:
            raise HTTPException(status_code=404, detail="State not found")

        state = state[0]
        state["models"] = json.loads(state["models"])
        state["basis_files"] = json.loads(state["basis_files"])
        state["themes"] = json.loads(state["themes"])
        state["selected_posts"] = json.loads(state["selected_posts"])
        state["selected_themes"] = json.loads(state["selected_themes"])
        state["references"] = json.loads(state["references_data"])
        del state["references_data"]
        state["codebook"] = json.loads(state["codebook"])
        state["code_responses"] = json.loads(state["code_responses"])
        state["final_code_responses"] = json.loads(state["final_code_responses"])

        # Temporary folder to store exported files

        # Export Chroma collections
        chroma_client = HttpClient(host="localhost", port=8000)
        all_collections = chroma_client.list_collections()
        chroma_files:  list[str] = []

        for collection in all_collections:
            if state["dataset_id"].replace("-", "_") in collection.name:
                collection = chroma_client.get_collection(collection.name)
                export_file = f"{temp_folder}/{collection.name}.jsonl"
                chroma_export_cli(collection=collection.name, export_file=export_file)
                chroma_files.append(export_file)
        print(f"Exported Chroma collections: {chroma_files}")

        basis_pdf_paths: list[str] = []
        for basis_file in state["basis_files"].values():
            path = find_file_with_time("./basis_files", state["dataset_id"], basis_file)
            if path:
                basis_pdf_paths.append(path)
        print(f"Exported basis files: {basis_pdf_paths}")

        # Save workspace state to a JSON file
        workspace_file = f"{temp_folder}/workspace_data.json"
        with open(workspace_file, "w") as wf:
            json.dump(state, wf, indent=4)

        # Create a ZIP file containing all exported data
        zip_file = f"/export_temp/{workspace_id}.zip"
        with ZipFile(zip_file, "w") as zf:
            zf.write(workspace_file, "workspace_data.json")
            for chroma_file in chroma_files:
                zf.write(chroma_file, chroma_file.split("/")[-1])
            for basis_pdf_path in basis_pdf_paths:
                zf.write(basis_pdf_path, basis_pdf_path.split("/")[-1])

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
@log_execution_time()
async def import_workspace(
    user_email: str = Form(...),
    file: UploadFile = File(...)
):
    # try:
        # Create a temporary directory for file extraction
        prefix = f"{str(uuid4())}_{time.time()}"
        temp_dir = "./import_temp/"+prefix
        os.makedirs(temp_dir, exist_ok=True)

        if not file.filename.endswith(".zip"):
            raise HTTPException(status_code=400, detail="Uploaded file is not a ZIP file")

        # Create a unique file path for the uploaded ZIP file
        zip_file_path = os.path.join(temp_dir, f"{prefix}_{file.filename}")

        # Save the uploaded file
        with open(zip_file_path, "wb") as temp_file:
            while chunk := await file.read(1024 * 1024):  # Read in 1MB chunks
                temp_file.write(chunk)

        print(f"Saved streamed file to: {zip_file_path}")

        # Validate ZIP file
        with ZipFile(zip_file_path, 'r') as zip_ref:
            zip_ref.testzip()
            zip_ref.extractall(temp_dir)

        print(f"Extracted ZIP file to: {temp_dir}")

        # Locate and validate workspace_data.json
        workspace_data_path = os.path.join(temp_dir, "workspace_data.json")
        if not os.path.exists(workspace_data_path):
            raise HTTPException(status_code=400, detail="workspace_data.json is missing in the uploaded ZIP file")

        with open(workspace_data_path, "r") as wf:
            workspace_data = json.load(wf)

        print("Workspace data: ", workspace_data)

        # Extract data from workspace_data.json
        workspace_id = workspace_data.get("workspace_id", str(uuid4()))
        workspace_name = workspace_data.get("name", "Imported Workspace")
        workspace_description = workspace_data.get("description")
        dataset_id = workspace_data.get("dataset_id")
        # mode_input = workspace_data.get("mode_input")
        # subreddit = workspace_data.get("subreddit")

        models = json.dumps(workspace_data.get("models", []))

        selected_posts = json.dumps(workspace_data.get("selected_posts", []))
        main_code = workspace_data.get("main_code")
        additional_info = workspace_data.get("additional_info")
        basis_files = json.dumps(workspace_data.get("basis_files", {}))
        themes = json.dumps(workspace_data.get("themes", []))
        selected_themes = json.dumps(workspace_data.get("selected_themes", []))
        codebook = json.dumps(workspace_data.get("codebook", []))
        references_data = json.dumps(workspace_data.get("references", []))
        code_responses = json.dumps(workspace_data.get("code_responses", []))
        final_code_responses = json.dumps(workspace_data.get("final_code_responses", []))



        print(f"Importing workspace: {workspace_id}, {workspace_name}, {workspace_description}, {dataset_id}, {user_email}, {models}, {selected_posts}, {main_code}, {additional_info}, {basis_files}, {themes}, {selected_themes}, {codebook}, {references_data}, {code_responses}, {final_code_responses}")
        # Check if workspace ID and email combination exists
        existing_workspace = run_query_with_columns(
            "SELECT 1 FROM workspace_states WHERE workspace_id = ? AND user_email = ?",
            (workspace_id, user_email)
        )
        if existing_workspace:
            # Generate new workspace ID
            workspace_id = str(uuid4()).replace("-", "_")

        # Add to workspace_states table
        run_query(
            """
            INSERT INTO workspace_states (
                workspace_id, user_email,
                selected_posts, models, main_code, additional_info, basis_files,
                themes, selected_themes, codebook, references_data,
                code_responses, final_code_responses, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                workspace_id, user_email,
                selected_posts, models, main_code, additional_info, basis_files,
                themes, selected_themes, codebook, references_data,
                code_responses, final_code_responses, datetime.now(),
            ),
        )

        # Add to workspaces table
        run_query(
            """
            INSERT INTO workspaces (id, name, description, user_email, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                workspace_id,
                workspace_name,
                workspace_description,
                user_email,
                datetime.now(),
            ),
        )

        # basis_pdf_paths = []
        # Process basis PDFs
        os.makedirs("./basis_files", exist_ok=True)
        for basis_file in workspace_data.get("basis_files", {}).values():
            print("Basis file: ", basis_file)
            basis_pdf_path = find_file_with_time(temp_dir, dataset_id, basis_file)
            print("Basis file: ", basis_pdf_path)
            if basis_pdf_path:
                shutil.copy(basis_pdf_path, "./basis_files")
                print(f"Imported basis file: {basis_pdf_path}")
        

        # Locate and import JSONL file
        jsonl_file = next(
            (os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.endswith(".jsonl")),
            None
        )
        if jsonl_file:
            file_name = os.path.basename(jsonl_file).split(".jsonl")[0]
            collection_name = file_name[:36]
            model_name = file_name[37:].replace("_", ":")
            print(f"Found JSONL file: {jsonl_file}, Collection: {collection_name}, Model: {model_name}")

            # Import into Chroma DB
            chroma_import(collection=file_name, import_file=jsonl_file, model=model_name, embedding_function="ollama")

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


