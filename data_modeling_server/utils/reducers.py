from typing import Any, Dict
from uuid import uuid4
from database.keyword_entry_table import KeywordEntriesRepository
from models.table_dataclasses import KeywordEntry


keyword_entries_repo = KeywordEntriesRepository()

# Parallel to frontend's keyword table reducer
def process_keyword_table_action(workspace_id: str, action: Dict[str, Any]) -> None:
    action_type = action["type"]

    if action_type == "INITIALIZE":
        # Replace all entries with the provided ones
        keyword_entries_repo.delete({"coding_context_id": workspace_id})
        for entry_data in action["entries"]:
            entry = KeywordEntry(
                id=entry_data.get("id", str(uuid4())),
                coding_context_id=workspace_id,
                word=entry_data["word"],
                description=entry_data.get("description"),
                inclusion_criteria=entry_data.get("inclusion_criteria"),
                exclusion_criteria=entry_data.get("exclusion_criteria"),
                is_marked=entry_data.get("isMarked")
            )
            keyword_entries_repo.insert(entry)

    elif action_type == "SET_ALL_CORRECT":
        # Update all entries to is_marked = true
        keyword_entries_repo.update({"coding_context_id": workspace_id}, {"is_marked": True})

    elif action_type == "SET_ALL_INCORRECT":
        # Update all entries to is_marked = false
        keyword_entries_repo.update({"coding_context_id": workspace_id}, {"is_marked": False})

    elif action_type == "SET_ALL_UNMARKED":
        # Update all entries to is_marked = None (undefined in TypeScript)
        keyword_entries_repo.update({"coding_context_id": workspace_id}, {"is_marked": None})

    elif action_type == "ADD_MANY":
        # Fetch current entries to check for existing words
        current_entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        existing_words = {entry.word for entry in current_entries}
        new_entries = [entry for entry in action["entries"] if entry["word"] not in existing_words]
        # Keep only entries where is_marked == true, then add new entries
        keyword_entries_repo.delete({"coding_context_id": workspace_id, "is_marked": [False, None]})
        for entry_data in new_entries:
            entry = KeywordEntry(
                id=entry_data.get("id", str(uuid4())),
                coding_context_id=workspace_id,
                word=entry_data["word"],
                description=entry_data.get("description"),
                inclusion_criteria=entry_data.get("inclusion_criteria"),
                exclusion_criteria=entry_data.get("exclusion_criteria"),
                is_marked=entry_data.get("isMarked")
            )
            keyword_entries_repo.insert(entry)

    elif action_type == "UPDATE_FIELD":
        # Fetch ordered entries to map index to entry
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            keyword_entries_repo.update(
                {"id": entry.id},
                {action["field"]: action["value"]}
            )

    elif action_type == "TOGGLE_MARK":
        # Fetch ordered entries to map index to entry
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            keyword_entries_repo.update(
                {"id": entry.id},
                {"is_marked": action["isMarked"]}
            )

    elif action_type == "ADD_ROW":
        # Add a new row with default or provided values
        entry_data = action.get("entry", {})
        entry = KeywordEntry(
            id=entry_data.get("id", str(uuid4())),
            coding_context_id=workspace_id,
            word=entry_data.get("word", ""),
            description=entry_data.get("description", ""),
            inclusion_criteria=entry_data.get("inclusion_criteria", ""),
            exclusion_criteria=entry_data.get("exclusion_criteria", ""),
            is_marked=True
        )
        keyword_entries_repo.insert(entry)

    elif action_type == "UNDO_DELETE_ROW":
        # Re-insert the provided entry
        entry_data = action["entry"]
        entry = KeywordEntry(
            id=entry_data.get("id", str(uuid4())),
            coding_context_id=workspace_id,
            word=entry_data["word"],
            description=entry_data.get("description"),
            inclusion_criteria=entry_data.get("inclusion_criteria"),
            exclusion_criteria=entry_data.get("exclusion_criteria"),
            is_marked=entry_data.get("isMarked")
        )
        keyword_entries_repo.insert(entry)

    elif action_type == "DELETE_ROW":
        # Fetch ordered entries to map index to entry, then delete
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        print(f"Deleting row at index {action['index']} from entries: {entries}")
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            keyword_entries_repo.delete({"id": entry.id})

    elif action_type == "RESET":
        # Clear all entries
        keyword_entries_repo.delete({"coding_context_id": workspace_id})

    elif action_type == "RESTORE_STATE":
        # Replace all entries with the provided payload
        keyword_entries_repo.delete({"coding_context_id": workspace_id})
        for entry_data in action["payload"]:
            entry = KeywordEntry(
                id=entry_data.get("id", str(uuid4())),
                coding_context_id=workspace_id,
                word=entry_data["word"],
                description=entry_data.get("description"),
                inclusion_criteria=entry_data.get("inclusion_criteria"),
                exclusion_criteria=entry_data.get("exclusion_criteria"),
                is_marked=bool(entry_data.get("isMarked"))
            )
            keyword_entries_repo.insert(entry)

    else:
        raise ValueError(f"Unknown action type: {action_type}")