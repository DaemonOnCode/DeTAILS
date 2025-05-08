from collections import defaultdict
import glob
import json
from datetime import datetime
import os
import shutil
import time
from typing import Any, Dict, List
from uuid import uuid4
from zipfile import ZipFile

from chromadb import HttpClient
from fastapi import HTTPException, UploadFile
from constants import STUDY_DATABASE_PATH
from controllers.workspace_controller import upgrade_workspace_from_temp
from database import (
    GroupedCodeEntriesRepository,
    ThemeEntriesRepository,
    ConceptEntriesRepository,
    WorkspaceStatesRepository, 
    WorkspacesRepository,
    InitialCodebookEntriesRepository,
    QectRepository,
    SelectedPostIdsRepository,
    SelectedConceptsRepository,
    ConceptsRepository,
    ContextFilesRepository,
    ResearchQuestionsRepository,
    CodingContextRepository,
    CollectionContextRepository
)
from database.state_dump_table import StateDumpsRepository
from models import WorkspaceState, Workspace
from models.state_models import CodingContext, CollectionContext, LoadingContext, ManualCodingContext, ModelingContext
from models.table_dataclasses import CodebookType, DataClassEncoder, StateDump
from utils.chroma_export import chroma_export_cli, chroma_import
from utils.reducers import process_all_responses_action, process_concept_table_action, process_grouped_codes_action, process_initial_codebook_table_action, process_sampled_copy_post_response_action, process_sampled_post_response_action, process_themes_action, process_unseen_post_response_action

workspace_state_repo = WorkspaceStatesRepository()
workspaces_repo = WorkspacesRepository()
coding_context_repo = CodingContextRepository()
context_files_repo = ContextFilesRepository()
research_question_repo = ResearchQuestionsRepository()
concepts_repo = ConceptsRepository()
selected_concepts_repo = SelectedConceptsRepository()
concept_entries_repo = ConceptEntriesRepository()
qect_repo = QectRepository()
selected_posts_repo = SelectedPostIdsRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()
grouped_codes_repo = GroupedCodeEntriesRepository()
themes_repo = ThemeEntriesRepository()
collection_context_repo = CollectionContextRepository()
state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

def save_state(data):
    state_dump_repo.insert(
        StateDump(
            state=json.dumps({
                "workspace_id": data.workspace_id,
                "user_email": data.user_email,
                "loading_context": data.loading_context,
            }),
            context=json.dumps({
                "function": "save_state",
                "page_url": data.page_url,
            }),
        )
    )

    loading_context = LoadingContext(**data.loading_context)


    page_state = json.dumps(loading_context.page_state)

    workspace_state = WorkspaceState(
        user_email=data.user_email,
        workspace_id=data.workspace_id,
        page_state=page_state,
        updated_at=datetime.now(),
    )

    try:
        existing_state = workspace_state_repo.find_one(
            {"workspace_id": data.workspace_id, "user_email": data.user_email}
        )
    except Exception as e:
        print(e)
        existing_state = None

    if existing_state:

        if workspace_state == existing_state:
            print("No changes to the workspace state.")
            return
        
        current_workspace = workspaces_repo.find_one(
            {"id": data.workspace_id}
        )

        emptyToFilled = False
        for field in workspace_state.to_dict():
            if field == "updated_at" or field == "user_email" or field == "workspace_id" or field == "workspace_id":
                continue
            current_value = getattr(workspace_state, field)
            previous_value = getattr(existing_state, field)
            if (current_value is not None and current_value != "") and (previous_value is None or previous_value == ""):
                print("Empty to Filled")
                emptyToFilled = True
                break

        if current_workspace.name == "Temporary Workspace" and emptyToFilled:
            upgrade_workspace_from_temp(data.workspace_id, "Untitled Workspace")
        
        workspace_state_repo.update(
            {"workspace_id": data.workspace_id, "user_email": data.user_email},
            workspace_state.to_dict()
        )
    else:
        workspace_state_repo.insert(workspace_state)

    workspaces_repo.update(
        {"id": data.workspace_id},
        {"updated_at": datetime.now()}
    )


def load_state(data):
    state = None
    try:
        state = workspace_state_repo.find_one(
            {"workspace_id": data.workspace_id, "user_email": data.user_email}
        )
    except Exception as e:
        print(e)

    if not state:
        return {"success": True, "data": None}

    json_fields = [
         "page_state"
    ]

    for field in json_fields:
        if getattr(state, field, None) is not None:
            setattr(state, field, json.loads(getattr(state, field)))

    return {"success": True, "data": state}

def delete_state(data):
    workspace_state_repo.delete({"workspace_id": data.workspace_id, "user_email": data.user_email})

    return {"success": True}


def find_file_with_time(folder_path: str, workspace_id: str, file_name: str) -> str:
    search_pattern = os.path.join(folder_path, f"{workspace_id}_*_{file_name}")

    matching_files = glob.glob(search_pattern)

    if not matching_files:
        return None
    
    return matching_files[0]

def export_workspace(workspace_id: str, user_email: str):
    temp_folder = f"/export_temp/{workspace_id}"
    os.makedirs(temp_folder, exist_ok=True)

    state = workspace_state_repo.find_one(
        {"workspace_id": workspace_id, "user_email": user_email}
    )

    if not state:
        raise ValueError("Workspace state not found.")

    workspace_details = workspaces_repo.find_one({"id": workspace_id})

    if not workspace_details:
        raise ValueError("Workspace details not found.")

    json_fields = [
        "models", "context_files", "themes", "selected_posts",
        "selected_themes", "references_data", "codebook",
        "code_responses", "final_code_responses"
    ]

    for field in json_fields:
        if getattr(state, field, None) is not None:
            setattr(state, field, json.loads(getattr(state, field)))

    state = state.to_dict()

    state["references"] = state["references_data"]
    del state["references_data"]

    state["workspace_name"] = workspace_details.name
    state["workspace_description"] = workspace_details.description

    chroma_client = HttpClient(host="localhost", port=8000)
    all_collections = chroma_client.list_collections()
    chroma_files: list[str] = []

    for collection in all_collections:
        if state["workspace_id"].replace("-", "_") in collection.name:
            collection = chroma_client.get_collection(collection.name)
            export_file = f"{temp_folder}/{collection.name}.jsonl"
            chroma_export_cli(collection=collection.name, export_file=export_file)
            chroma_files.append(export_file)

    print(f"Exported Chroma collections: {chroma_files}")

    context_pdf_paths: list[str] = []
    for context_file in state["context_files"].values():
        path = find_file_with_time("./context_files", state["workspace_id"], context_file)
        if path:
            context_pdf_paths.append(path)

    print(f"Exported basis files: {context_pdf_paths}")

    workspace_file = f"{temp_folder}/workspace_data.json"
    with open(workspace_file, "w") as wf:
        json.dump(state.__dict__, wf, indent=4)

    zip_file = f"/export_temp/{workspace_id}.zip"
    with ZipFile(zip_file, "w") as zf:
        zf.write(workspace_file, "workspace_data.json")
        for chroma_file in chroma_files:
            zf.write(chroma_file, os.path.basename(chroma_file))
        for context_pdf_path in context_pdf_paths:
            zf.write(context_pdf_path, os.path.basename(context_pdf_path))

    return zip_file, temp_folder

async def import_workspace(user_email: str, file: UploadFile):
    prefix = f"{str(uuid4())}_{time.time()}"
    temp_dir = f"./import_temp/{prefix}"
    os.makedirs(temp_dir, exist_ok=True)

    zip_file_path = os.path.join(temp_dir, f"{prefix}_{file.filename}")

    with open(zip_file_path, "wb") as temp_file:
        while chunk := await file.read(1024 * 1024): 
            temp_file.write(chunk)

    print(f"Saved streamed file to: {zip_file_path}")

    with ZipFile(zip_file_path, 'r') as zip_ref:
        zip_ref.testzip()
        zip_ref.extractall(temp_dir)

    print(f"Extracted ZIP file to: {temp_dir}")

    workspace_data_path = os.path.join(temp_dir, "workspace_data.json")
    if not os.path.exists(workspace_data_path):
        raise HTTPException(status_code=400, detail="workspace_data.json is missing in the uploaded ZIP file")

    with open(workspace_data_path, "r") as wf:
        workspace_data = json.load(wf)

    print("Workspace data: ", workspace_data)

    workspace_id = workspace_data.get("workspace_id", str(uuid4()))
    workspace_name = workspace_data.get("workspace_name", "Imported Workspace")
    workspace_description = workspace_data.get("workspace_description")
    workspace_id = workspace_data.get("workspace_id")

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

    print(f"Importing workspace: {workspace_id}, {workspace_name}, {workspace_description}, {workspace_id}")

    existing_workspace = workspace_state_repo.find_one({"workspace_id": workspace_id, "user_email": user_email})

    if existing_workspace:
        workspace_id = str(uuid4()).replace("-", "_")

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

    workspaces_repo.insert(Workspace(**{
        "id": workspace_id,
        "name": workspace_name,
        "description": workspace_description,
        "user_email": user_email,
        "created_at": datetime.now(),
    }))

    os.makedirs("./context_files", exist_ok=True)

    # Process context PDFs
    for context_file in workspace_data.get("context_files", {}).values():
        print("Processing basis file: ", context_file)
        context_pdf_path = find_file_with_time(temp_dir, workspace_id, context_file)
        if context_pdf_path:
            shutil.copy(context_pdf_path, "./context_files")
            print(f"Imported basis file: {context_pdf_path}")

    jsonl_file = next(
        (os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.endswith(".jsonl")),
        None
    )

    if jsonl_file:
        file_name = os.path.basename(jsonl_file).split(".jsonl")[0]
        collection_name = file_name[:36] 
        model_name = file_name[37:].replace("_", ":") 

        print(f"Found JSONL file: {jsonl_file}, Collection: {collection_name}, Model: {model_name}")

        chroma_import(collection=file_name, import_file=jsonl_file, model=model_name, embedding_function="ollama")

    return workspace_id, workspace_name, workspace_description


def get_grouped_code(code, workspace_id):
    grouped_code = grouped_codes_repo.find_one({"code": code, "coding_context_id": workspace_id }, map_to_model=False)

    if not grouped_code:
        raise HTTPException(status_code=404, detail="Grouped code not found.")

    return grouped_code

def get_theme_by_code(code, workspace_id):
    grouped_code = grouped_codes_repo.find_one({"code": code, "coding_context_id": workspace_id })
    if not grouped_code:
        raise HTTPException(status_code=404, detail="Grouped code not found.")

    theme = themes_repo.find_one({"higher_level_code": grouped_code.higher_level_code, "coding_context_id": workspace_id }, map_to_model=False)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found.")

    return theme


def add_state_to_dump(state: str, workspace_id: str, function: str, origin: str):
    state_dump_repo.insert(
        StateDump(
            state=json.dumps(state, cls=DataClassEncoder),
            context=json.dumps({
                "function": function,
                "workspace_id": workspace_id,
                "origin": origin,
            }),
        )
    )

def load_concept_outline_table(workspace_id: str) -> List[Dict[str, Any]]:
    concept_entries = concept_entries_repo.find({"coding_context_id": workspace_id})
    return [
        {
            "id": ke.id,
            "word": ke.word,
            "description": ke.description,
            "isMarked": bool(ke.is_marked)
        }
        for ke in concept_entries
    ]

def load_sampled_post_response(workspace_id: str) -> List[Dict[str, Any]]:
    sampled_posts = selected_posts_repo.find({"workspace_id": workspace_id, "type": "sampled"})
    post_ids = [sp.post_id for sp in sampled_posts]
    qect_responses = qect_repo.find({
        "workspace_id": workspace_id,
        "post_id": post_ids,
        "codebook_type": CodebookType.INITIAL.value
    })
    return [
        {
            "id": qr.id,
            "quote": qr.quote,
            "code": qr.code,
            "explanation": qr.explanation,
            "postId": qr.post_id,
            "chatHistory": json.loads(qr.chat_history) if qr.chat_history else None,
            "isMarked": bool(qr.is_marked) if qr.is_marked is not None else None,
            "comment": "",
            "rangeMarker": json.loads(qr.range_marker) if qr.range_marker else None,
        }
        for qr in qect_responses
    ]

def load_sampled_copy_post_response(workspace_id: str) -> List[Dict[str, Any]]:
    sampled_posts = selected_posts_repo.find({"workspace_id": workspace_id, "type": "sampled"})
    post_ids = [sp.post_id for sp in sampled_posts]
    qect_responses = qect_repo.find({
        "workspace_id": workspace_id,
        "post_id": post_ids,
        "codebook_type": CodebookType.INITIAL_COPY.value
    })
    return [
        {
            "id": qr.id,
            "quote": qr.quote,
            "code": qr.code,
            "explanation": qr.explanation,
            "postId": qr.post_id,
            "chatHistory": json.loads(qr.chat_history) if qr.chat_history else None,
            "isMarked": bool(qr.is_marked) if qr.is_marked is not None else None,
            "comment": "",
            "rangeMarker": json.loads(qr.range_marker) if qr.range_marker else None,
        }
        for qr in qect_responses
    ]


def load_main_topic(workspace_id: str) -> str:
    coding_context = coding_context_repo.find_one({"id": workspace_id}, fail_silently=True)
    return coding_context.main_topic or "" if coding_context else ""

def load_additional_info(workspace_id: str) -> str:
    coding_context = coding_context_repo.find_one({"id": workspace_id}, fail_silently=True)
    return coding_context.additional_info or "" if coding_context else ""

def load_context_files(workspace_id: str) -> Dict[str, str]:
    context_files = context_files_repo.find({"coding_context_id": workspace_id})
    return {file.file_path: file.file_name for file in context_files}

def load_research_questions(workspace_id: str) -> List[str]:
    research_questions = research_question_repo.find({"coding_context_id": workspace_id})
    return [rq.question for rq in research_questions]

def load_concepts(workspace_id: str) -> List[Dict[str, Any]]:
    concepts = concepts_repo.find({"coding_context_id": workspace_id})
    return [{"id": kw.id, "word": kw.word} for kw in concepts]

def load_selected_concepts(workspace_id: str) -> List[str]:
    selected_concepts = selected_concepts_repo.find({"coding_context_id": workspace_id})
    return [sk.concept_id for sk in selected_concepts]

def load_grouped_codes(workspace_id: str) -> Dict[str, tuple[str, List[str]]]:
    grouped_entries = grouped_codes_repo.find({"coding_context_id": workspace_id})
    grouped_codes_dict = defaultdict(list)
    higher_level_codes = {}
    for entry in grouped_entries:
        grouped_codes_dict[entry.higher_level_code_id].append(entry.code)
        if entry.higher_level_code_id not in higher_level_codes:
            higher_level_codes[entry.higher_level_code_id] = entry.higher_level_code
    return {hid: (hlc, codes) for hid, hlc in higher_level_codes.items() for codes in [grouped_codes_dict[hid]]}

def load_themes(workspace_id: str) -> Dict[str, tuple[str, List[str]]]:
    theme_entries = themes_repo.find({"coding_context_id": workspace_id})
    themes_dict = defaultdict(list)
    theme_names = {}
    for entry in theme_entries:
        themes_dict[entry["theme_id"]].append(entry["higher_level_code"])
        if entry["theme_id"] not in theme_names:
            theme_names[entry["theme_id"]] = entry["theme"]
    return {tid: (tname, codes) for tid, tname in theme_names.items() for codes in [themes_dict[tid]]}

def format_grouped_codes(entries):
    grouped_codes_dict = defaultdict(list)
    for entry in entries:
        grouped_codes_dict[entry.higher_level_code_id].append(entry.code)
    higher_level_codes = {e.higher_level_code_id: e.higher_level_code for e in entries}
    return [
        {"id": hid, "name": higher_level_codes[hid], "codes": list(filter(bool, codes))}
        for hid, codes in grouped_codes_dict.items()
    ]

def format_themes(entries):
    themes_dict = defaultdict(list)
    theme_names = {}
    for entry in entries:
        themes_dict[entry["theme_id"]].append(entry["higher_level_code"])
        if entry["theme_id"] not in theme_names:
            theme_names[entry["theme_id"]] = entry["theme"]
    return [
        {"id": tid, "name": theme_names[tid], "codes": list(filter(bool, codes))}
        for tid, codes in themes_dict.items()
    ]

load_functions = {
    "mainTopic": load_main_topic,
    "additionalInfo": load_additional_info,
    "contextFiles": load_context_files,
    "researchQuestions": load_research_questions,
    "concepts": load_concepts,
    "selectedConcepts": load_selected_concepts,
    "conceptOutlineTable": load_concept_outline_table,
    "sampledPostResponse": load_sampled_post_response,
    "sampledCopyPostResponse": load_sampled_copy_post_response,
    "sampledPostIds": lambda ws: [sp.post_id for sp in selected_posts_repo.find({"workspace_id": ws, "type": "sampled"})],
    "unseenPostIds": lambda ws: [sp.post_id for sp in selected_posts_repo.find({"workspace_id": ws, "type": "unseen"})],
    "unseenPostResponse": lambda ws: [
        {
            "id": qr.id,
            "quote": qr.quote,
            "code": qr.code,
            "explanation": qr.explanation,
            "postId": qr.post_id,
            "chatHistory": json.loads(qr.chat_history) if qr.chat_history else None,
            "isMarked": bool(qr.is_marked) if qr.is_marked is not None else None,
            "comment": "",
            "rangeMarker": json.loads(qr.range_marker) if qr.range_marker else None,
            "type": qr.response_type,
        }
        for qr in qect_repo.find({"workspace_id": ws, "codebook_type": CodebookType.FINAL.value})
    ],
    "initialCodebookTable": lambda ws: [
        {"id": entry.id, "code": entry.code, "definition": entry.definition}
        for entry in initial_codebook_repo.find({"coding_context_id": ws})
    ],
    "groupedCodes": lambda ws: [
        {"id": hid, "name": hlc, "codes": list(filter(bool, codes))}
        for hid, (hlc, codes) in load_grouped_codes(ws).items()
    ],
    "themes": lambda ws: [
        {"id": tid, "name": tname, "codes": list(filter(bool, codes))}
        for tid, (tname, codes) in load_themes(ws).items()
    ],
}



dispatch_configs = {
    "dispatchConceptOutlinesTable": {
        "response_key": "conceptOutlineTable",
        "process_func": process_concept_table_action,
        "repo": concept_entries_repo,
        "conditions": lambda ws: {"coding_context_id": ws},
        "format_func": lambda ke: {
            "id": ke.id,
            "word": ke.word,
            "description": ke.description,
            "inclusion_criteria": ke.inclusion_criteria,
            "exclusion_criteria": ke.exclusion_criteria,
            "isMarked": bool(ke.is_marked)
        }
    },
    "dispatchSampledPostResponse": {
        "response_key": "sampledPostResponse",
        "process_func": process_sampled_post_response_action,
        "repo": qect_repo,
        "conditions": lambda ws: {"workspace_id": ws, "codebook_type": CodebookType.INITIAL.value},
        "format_func": lambda response: {
            "id": response.id,
            "quote": response.quote,
            "code": response.code,
            "explanation": response.explanation,
            "postId": response.post_id,
            "chatHistory": json.loads(response.chat_history) if response.chat_history else None,
            "isMarked": bool(response.is_marked) if response.is_marked is not None else None,
            "comment": "",
            "rangeMarker": json.loads(response.range_marker) if response.range_marker else None,
        }
    },
    "dispatchInitialCodebookTable": {
        "response_key": "initialCodebookTable",
        "process_func": process_initial_codebook_table_action,
        "repo": initial_codebook_repo,
        "conditions": lambda ws: {"coding_context_id": ws},
        "format_func": lambda entry: entry.to_dict()
    },
    "dispatchSampledCopyPostResponse": {
        "response_key": "sampledCopyPostResponse",
        "process_func": process_sampled_copy_post_response_action,
        "repo": qect_repo,
        "conditions": lambda ws: {"workspace_id": ws, "codebook_type": CodebookType.INITIAL_COPY.value},
        "format_func": lambda response: {
            "id": response.id,
            "quote": response.quote,
            "code": response.code,
            "explanation": response.explanation,
            "postId": response.post_id,
            "chatHistory": json.loads(response.chat_history) if response.chat_history else None,
            "isMarked": bool(response.is_marked) if response.is_marked is not None else None,
            "comment": "",
            "rangeMarker": json.loads(response.range_marker) if response.range_marker else None,
        }
    },
    "dispatchUnseenPostResponse": {
        "response_key": "unseenPostResponse",
        "process_func": process_unseen_post_response_action,
        "repo": qect_repo,
        "conditions": lambda ws: {"workspace_id": ws, "codebook_type": CodebookType.FINAL.value},
        "format_func": lambda response: {
            "id": response.id,
            "quote": response.quote,
            "code": response.code,
            "explanation": response.explanation,
            "postId": response.post_id,
            "chatHistory": json.loads(response.chat_history) if response.chat_history else None,
            "isMarked": bool(response.is_marked) if response.is_marked is not None else None,
            "comment": "",
            "rangeMarker": json.loads(response.range_marker) if response.range_marker else None,
            "type": response.response_type,
        }
    },
    "dispatchAllPostResponse": {
        "response_key": "allPostResponse",
        "process_func": process_all_responses_action,
        "repo": qect_repo,
        "conditions": lambda ws: {"workspace_id": ws},
        "format_func": lambda response: {
            "id": response.id,
            "quote": response.quote,
            "code": response.code,
            "explanation": response.explanation,
            "postId": response.post_id,
            "chatHistory": json.loads(response.chat_history) if response.chat_history else None,
            "isMarked": bool(response.is_marked) if response.is_marked is not None else None,
            "comment": "",
            "rangeMarker": json.loads(response.range_marker) if response.range_marker else None,
        }
    },
    "dispatchGroupedCodes": {
        "response_key": "groupedCodes",
        "process_func": process_grouped_codes_action,
        "repo": grouped_codes_repo,
        "conditions": lambda ws: {"coding_context_id": ws},
        "format_func": format_grouped_codes
    },
    "dispatchThemes": {
        "response_key": "themes",
        "process_func": process_themes_action,
        "repo": themes_repo,
        "conditions": lambda ws: {"coding_context_id": ws},
        "format_func": format_themes
    }
}