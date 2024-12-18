import json
import sqlite3
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from constants import DATABASE_PATH


router = APIRouter()

class SaveStateRequest(BaseModel):
    workspace_id: str
    user_email: str
    dataset_id: str
    workspace_data: List[Dict[str, Any]]
    coding_context: Dict[str, Any]
    collection_context: Dict[str, Any]


def initialize_database():
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()

        # Create workspaces table with user_email
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workspace_states (
            workspace_id TEXT NOT NULL,
            user_email TEXT NOT NULL,
            dataset_id TEXT NOT NULL,
            workspace_data TEXT,
            basis_files TEXT,
            main_code TEXT,
            additional_info TEXT,
            flashcards TEXT,
            selected_flashcards TEXT,
            themes TEXT,
            selected_themes TEXT,
            words TEXT,
            selected_words TEXT,
            references TEXT,
            code_book TEXT,
            code_responses TEXT,
            final_code_responses TEXT,
            collection_context TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (workspace_id, user_email, dataset_id)
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

@router.post("/save")
def save_state(request: SaveStateRequest):
    try:
        # Prepare JSON objects for insertion
        workspace_data = json.dumps(request.workspace_data)
        basis_files = json.dumps(request.coding_context.get("basis_files", {}))
        flashcards = json.dumps(request.coding_context.get("flashcards", []))
        selected_flashcards = json.dumps(request.coding_context.get("selected_flashcards", []))
        themes = json.dumps(request.coding_context.get("themes", []))
        selected_themes = json.dumps(request.coding_context.get("selected_themes", []))
        words = json.dumps(request.coding_context.get("words", []))
        selected_words = json.dumps(request.coding_context.get("selected_words", []))
        references = json.dumps(request.coding_context.get("references", {}))
        code_book = json.dumps(request.coding_context.get("code_book", []))
        code_responses = json.dumps(request.coding_context.get("code_responses", []))
        final_code_responses = json.dumps(request.coding_context.get("final_code_responses", []))
        collection_context = json.dumps(request.collection_context)

        # Insert or update the user context based on workspace_id, user_email, and dataset_id
        run_query(
            """
            INSERT INTO workspace_states (
                workspace_id, user_email, dataset_id, workspace_data, basis_files, main_code, 
                additional_info, flashcards, selected_flashcards, themes, selected_themes, words, 
                selected_words, references, code_book, code_responses, final_code_responses, 
                collection_context, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(workspace_id, user_email, dataset_id) DO UPDATE SET
                workspace_data = excluded.workspace_data,
                basis_files = excluded.basis_files,
                main_code = excluded.main_code,
                additional_info = excluded.additional_info,
                flashcards = excluded.flashcards,
                selected_flashcards = excluded.selected_flashcards,
                themes = excluded.themes,
                selected_themes = excluded.selected_themes,
                words = excluded.words,
                selected_words = excluded.selected_words,
                references = excluded.references,
                code_book = excluded.code_book,
                code_responses = excluded.code_responses,
                final_code_responses = excluded.final_code_responses,
                collection_context = excluded.collection_context,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                request.workspace_id, request.user_email, request.dataset_id, workspace_data, basis_files,
                request.coding_context.get("main_code", ""), request.coding_context.get("additional_info", ""),
                flashcards, selected_flashcards, themes, selected_themes, words, selected_words,
                references, code_book, code_responses, final_code_responses, collection_context
            ),
        )

        return {"message": "Context saved successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))