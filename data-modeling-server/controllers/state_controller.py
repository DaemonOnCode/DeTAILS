import glob
import json
from datetime import datetime
import os
import shutil
import time
from uuid import uuid4
from zipfile import ZipFile

from chromadb import HttpClient
from fastapi import HTTPException, UploadFile
from constants import STUDY_DATABASE_PATH
from controllers.workspace_controller import upgrade_workspace_from_temp
from database.state_dump_table import StateDumpsRepository
from models import WorkspaceState, Workspace
from database import WorkspaceStatesRepository, WorkspacesRepository
from models.state_models import CodingContext, CollectionContext, LoadingContext, ManualCodingContext, ModelingContext
from models.table_dataclasses import StateDump
from utils.chroma_export import chroma_export_cli, chroma_import

workspace_state_repo = WorkspaceStatesRepository()
workspaces_repo = WorkspacesRepository()
state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

def save_state(data):
    # Create context objects from data

    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "workspace_id": data.workspace_id,
                "user_email": data.user_email,
                "collection_context": data.collection_context,
                "coding_context": data.coding_context,
                "modeling_context": data.modeling_context,
                "loading_context": data.loading_context,
                "manual_coding_context": data.manual_coding_context,
            }),
            context=json.dumps({
                "function": "save_state",
            }),
        )
    )

    collection_context = CollectionContext(**data.collection_context)
    coding_context = CodingContext(**data.coding_context)
    modeling_context = ModelingContext(**data.modeling_context)
    loading_context = LoadingContext(**data.loading_context)
    manual_coding_context = ManualCodingContext(**data.manual_coding_context)

    # Convert complex objects to JSON strings for storage
    metadata = json.dumps(collection_context.metadata)
    selected_data = json.dumps(collection_context.selected_data)
    data_filters = json.dumps(collection_context.data_filters)

    models = json.dumps(modeling_context.models)
    context_files = json.dumps(coding_context.context_files)
    keywords = json.dumps(coding_context.keywords)
    selected_keywords = json.dumps(coding_context.selected_keywords)
    keyword_table = json.dumps(coding_context.keyword_table)
    references_data = json.dumps(coding_context.references_data)
    themes = json.dumps(coding_context.themes)
    grouped_codes = json.dumps(coding_context.grouped_codes)
    research_questions = json.dumps(coding_context.research_questions)
    sampled_post_responses = json.dumps(coding_context.sampled_post_responses)
    sampled_post_with_themes_responses = json.dumps(coding_context.sampled_post_with_themes_responses)
    unseen_post_response = json.dumps(coding_context.unseen_post_response)
    unplaced_codes = json.dumps(coding_context.unplaced_codes)
    unplaced_subcodes = json.dumps(coding_context.unplaced_subcodes)
    sampled_post_ids = json.dumps(coding_context.sampled_post_ids)
    unseen_post_ids = json.dumps(coding_context.unseen_post_ids)
    conflicting_responses = json.dumps(coding_context.conflicting_responses)
    initial_codebook = json.dumps(coding_context.initial_codebook)


    page_state = json.dumps(loading_context.page_state)

    post_states = json.dumps(manual_coding_context.post_states)
    manual_coding_responses = json.dumps(manual_coding_context.manual_coding_responses)
    codebook = json.dumps(manual_coding_context.codebook)

    # Create a workspace state object
    workspace_state = WorkspaceState(
        user_email=data.user_email,
        workspace_id=data.workspace_id,
        dataset_id=data.dataset_id,
        mode_input=collection_context.mode_input,
        type=collection_context.type,
        metadata=metadata,
        selected_data=selected_data,
        models=models,
        data_filters=data_filters,
        is_locked=collection_context.is_locked,
        main_topic=coding_context.main_topic,
        additional_info=coding_context.additional_info,
        context_files=context_files,
        keywords=keywords,
        selected_keywords=selected_keywords,
        keyword_table=keyword_table,
        references_data=references_data,
        themes=themes,
        grouped_codes=grouped_codes,
        research_questions=research_questions,
        sampled_post_responses=sampled_post_responses,
        sampled_post_with_themes_responses=sampled_post_with_themes_responses,
        unseen_post_response=unseen_post_response,
        unplaced_codes=unplaced_codes,
        unplaced_subcodes=unplaced_subcodes,
        sampled_post_ids=sampled_post_ids,
        unseen_post_ids=unseen_post_ids,
        conflicting_responses=conflicting_responses,
        initial_codebook=initial_codebook,
        page_state=page_state,
        post_states=post_states,
        manual_coding_responses=manual_coding_responses,
        codebook=codebook,
        updated_at=datetime.now(),
    )

    # Check if the workspace state already exists
    try:
        existing_state = workspace_state_repo.find_one(
            {"workspace_id": data.workspace_id, "user_email": data.user_email}
        )
    except Exception as e:
        print(e)
        existing_state = None

    if existing_state:

        if workspace_state == existing_state:
            # No changes to the workspace state
            print("No changes to the workspace state.")
            return
        
        current_workspace = workspaces_repo.find_one(
            {"id": data.workspace_id}
        )

        emptyToFilled = False
        for field in workspace_state.to_dict():
            if field == "updated_at" or field == "user_email" or field == "workspace_id" or field == "dataset_id":
                continue
            current_value = getattr(workspace_state, field)
            previous_value = getattr(existing_state, field)
            # print(f"Field: {field}, Current: {current_value}, Previous: {previous_value}")
            if (current_value is not None and current_value != "") and (previous_value is None or previous_value == ""):
                print("Empty to Filled")
                emptyToFilled = True
                break

        if current_workspace.name == "Temporary Workspace" and emptyToFilled:
            upgrade_workspace_from_temp(data.workspace_id, "Untitled Workspace")
        

        # Update the existing record
        workspace_state_repo.update(
            {"workspace_id": data.workspace_id, "user_email": data.user_email},
            workspace_state.to_dict()
        )
    else:
        # Insert a new record
        workspace_state_repo.insert(workspace_state)

    workspaces_repo.update(
        {"id": data.workspace_id},
        {"updated_at": datetime.now()}
    )


def load_state(data):
    # Fetch the workspace state from the database
    state = None
    try:
        state = workspace_state_repo.find_one(
            {"workspace_id": data.workspace_id, "user_email": data.user_email}
        )
    except Exception as e:
        print(e)

    if not state:
        return {"success": True, "data": None}

    # Convert JSON strings back to Python objects
    json_fields = [
        "selected_data", "metadata", "models", "data_filters", "context_files", "keywords", "selected_keywords",
        "keyword_table", "references_data", "themes", "grouped_codes", "research_questions",
        "sampled_post_responses", "sampled_post_with_themes_responses", "initial_codebook",
        "unseen_post_response", "unplaced_codes", "unplaced_subcodes", "sampled_post_ids", "unseen_post_ids",
        "conflicting_responses", "page_state", "post_states", "manual_coding_responses", "codebook"
    ]

    for field in json_fields:
        if getattr(state, field, None) is not None:
            setattr(state, field, json.loads(getattr(state, field)))

    return {"success": True, "data": state}

def delete_state(data):
    workspace_state_repo.delete({"workspace_id": data.workspace_id, "user_email": data.user_email})

    return {"success": True}


def find_file_with_time(folder_path: str, dataset_id: str, file_name: str) -> str:
    # Construct the search pattern
    search_pattern = os.path.join(folder_path, f"{dataset_id}_*_{file_name}")

    # Find files matching the pattern
    matching_files = glob.glob(search_pattern)

    if not matching_files:
        return None
    
    # Return the first matching file (if multiple files, handle based on requirements)
    return matching_files[0]

def export_workspace(workspace_id: str, user_email: str):
    """
    Exports a workspace including its state, Chroma collections, and basis files.

    :param workspace_id: The ID of the workspace.
    :param user_email: The email of the user.
    :return: The path to the exported ZIP file and the temporary folder.
    """

    # Define temporary folder for export
    temp_folder = f"/export_temp/{workspace_id}"
    os.makedirs(temp_folder, exist_ok=True)

    # Fetch workspace state from the database
    state = workspace_state_repo.find_one(
        {"workspace_id": workspace_id, "user_email": user_email}
    )

    if not state:
        raise ValueError("Workspace state not found.")

    # Fetch additional workspace details
    workspace_details = workspaces_repo.find_one({"id": workspace_id})

    if not workspace_details:
        raise ValueError("Workspace details not found.")

    # Convert JSON string fields to Python objects
    json_fields = [
        "models", "context_files", "themes", "selected_posts",
        "selected_themes", "references_data", "codebook",
        "code_responses", "final_code_responses"
    ]

    for field in json_fields:
        if getattr(state, field, None) is not None:
            setattr(state, field, json.loads(getattr(state, field)))

    state = state.to_dict()

    # Rename "references_data" to "references" for consistency
    state["references"] = state["references_data"]
    del state["references_data"]

    # Add workspace details
    state["workspace_name"] = workspace_details.name
    state["workspace_description"] = workspace_details.description

    # Export Chroma collections
    chroma_client = HttpClient(host="localhost", port=8000)
    all_collections = chroma_client.list_collections()
    chroma_files: list[str] = []

    for collection in all_collections:
        if state["dataset_id"].replace("-", "_") in collection.name:
            collection = chroma_client.get_collection(collection.name)
            export_file = f"{temp_folder}/{collection.name}.jsonl"
            chroma_export_cli(collection=collection.name, export_file=export_file)
            chroma_files.append(export_file)

    print(f"Exported Chroma collections: {chroma_files}")

    # Export basis files
    context_pdf_paths: list[str] = []
    for context_file in state["context_files"].values():
        path = find_file_with_time("./context_files", state["dataset_id"], context_file)
        if path:
            context_pdf_paths.append(path)

    print(f"Exported basis files: {context_pdf_paths}")

    # Save workspace state to a JSON file
    workspace_file = f"{temp_folder}/workspace_data.json"
    with open(workspace_file, "w") as wf:
        json.dump(state.__dict__, wf, indent=4)

    # Create a ZIP file containing all exported data
    zip_file = f"/export_temp/{workspace_id}.zip"
    with ZipFile(zip_file, "w") as zf:
        zf.write(workspace_file, "workspace_data.json")
        for chroma_file in chroma_files:
            zf.write(chroma_file, os.path.basename(chroma_file))
        for context_pdf_path in context_pdf_paths:
            zf.write(context_pdf_path, os.path.basename(context_pdf_path))

    return zip_file, temp_folder

async def import_workspace(user_email: str, file: UploadFile):
    """
    Imports a workspace from a ZIP file containing a workspace state JSON and related files.

    :param user_email: The email of the user importing the workspace.
    :param file: The uploaded ZIP file.
    :return: The new workspace ID, name, and description.
    """

    # Create a unique temporary directory for processing
    prefix = f"{str(uuid4())}_{time.time()}"
    temp_dir = f"./import_temp/{prefix}"
    os.makedirs(temp_dir, exist_ok=True)

    # Save uploaded ZIP file
    zip_file_path = os.path.join(temp_dir, f"{prefix}_{file.filename}")

    with open(zip_file_path, "wb") as temp_file:
        while chunk := await file.read(1024 * 1024):  # Read in 1MB chunks
            temp_file.write(chunk)

    print(f"Saved streamed file to: {zip_file_path}")

    # Validate and extract ZIP file
    with ZipFile(zip_file_path, 'r') as zip_ref:
        zip_ref.testzip()
        zip_ref.extractall(temp_dir)

    print(f"Extracted ZIP file to: {temp_dir}")

    # Validate workspace_data.json
    workspace_data_path = os.path.join(temp_dir, "workspace_data.json")
    if not os.path.exists(workspace_data_path):
        raise HTTPException(status_code=400, detail="workspace_data.json is missing in the uploaded ZIP file")

    with open(workspace_data_path, "r") as wf:
        workspace_data = json.load(wf)

    print("Workspace data: ", workspace_data)

    # Extract workspace data
    workspace_id = workspace_data.get("workspace_id", str(uuid4()))
    workspace_name = workspace_data.get("workspace_name", "Imported Workspace")
    workspace_description = workspace_data.get("workspace_description")
    dataset_id = workspace_data.get("dataset_id")

    models = json.dumps(workspace_data.get("models", []))
    selected_posts = json.dumps(workspace_data.get("selected_posts", []))
    main_code = workspace_data.get("main_code")
    additional_info = workspace_data.get("additional_info")
    context_files = json.dumps(workspace_data.get("context_files", {}))
    themes = json.dumps(workspace_data.get("themes", []))
    selected_themes = json.dumps(workspace_data.get("selected_themes", []))
    codebook = json.dumps(workspace_data.get("codebook", []))
    references_data = json.dumps(workspace_data.get("references", []))
    code_responses = json.dumps(workspace_data.get("code_responses", []))
    final_code_responses = json.dumps(workspace_data.get("final_code_responses", []))

    print(f"Importing workspace: {workspace_id}, {workspace_name}, {workspace_description}, {dataset_id}")

    # Check if workspace ID and email combination exists
    existing_workspace = workspace_state_repo.find_one({"workspace_id": workspace_id, "user_email": user_email})

    if existing_workspace:
        # Generate new workspace ID to avoid conflicts
        workspace_id = str(uuid4()).replace("-", "_")

    # Insert into `workspace_states` table
    workspace_state_repo.insert(WorkspaceState(**{
        "workspace_id": workspace_id,
        "user_email": user_email,
        "selected_posts": selected_posts,
        "models": models,
        "main_code": main_code,
        "additional_info": additional_info,
        "context_files": context_files,
        "themes": themes,
        "selected_themes": selected_themes,
        "codebook": codebook,
        "references_data": references_data,
        "code_responses": code_responses,
        "final_code_responses": final_code_responses,
        "updated_at": datetime.now(),
    }))

    # Insert into `workspaces` table
    workspaces_repo.insert(Workspace(**{
        "id": workspace_id,
        "name": workspace_name,
        "description": workspace_description,
        "user_email": user_email,
        "created_at": datetime.now(),
    }))

    # Ensure basis files directory exists
    os.makedirs("./context_files", exist_ok=True)

    # Process basis PDFs
    for context_file in workspace_data.get("context_files", {}).values():
        print("Processing basis file: ", context_file)
        context_pdf_path = find_file_with_time(temp_dir, dataset_id, context_file)
        if context_pdf_path:
            shutil.copy(context_pdf_path, "./context_files")
            print(f"Imported basis file: {context_pdf_path}")

    # Locate and import JSONL file for Chroma DB
    jsonl_file = next(
        (os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.endswith(".jsonl")),
        None
    )

    if jsonl_file:
        file_name = os.path.basename(jsonl_file).split(".jsonl")[0]
        collection_name = file_name[:36]  # Extract first part as collection name
        model_name = file_name[37:].replace("_", ":")  # Extract model name

        print(f"Found JSONL file: {jsonl_file}, Collection: {collection_name}, Model: {model_name}")

        # Import into Chroma DB
        chroma_import(collection=file_name, import_file=jsonl_file, model=model_name, embedding_function="ollama")

    return workspace_id, workspace_name, workspace_description