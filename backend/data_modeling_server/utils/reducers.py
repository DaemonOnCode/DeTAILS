from datetime import datetime
import json
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import HTTPException
from config import CustomSettings
from database.base_class import BaseRepository
from database.grouped_code_table import GroupedCodeEntriesRepository
from database.initial_codebook_table import InitialCodebookEntriesRepository
from database.keyword_entry_table import KeywordEntriesRepository
from database.qect_table import QectRepository
from database.theme_table import ThemeEntriesRepository
from models.table_dataclasses import BaseDataclass, CodebookType, GroupedCodeEntry, InitialCodebookEntry, KeywordEntry, QectResponse, ResponseCreatorType, ThemeEntry


keyword_entries_repo = KeywordEntriesRepository()
qect_repo = QectRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()
grouped_code_repo = GroupedCodeEntriesRepository()
themes_repo = ThemeEntriesRepository()

Diff = Dict[str, List[Any]]

def merge_diffs(diff1: Diff, diff2: Diff) -> Diff:
    # 1) Just concatenate inserted/deleted lists
    merged_inserted = diff1.get("inserted", []) + diff2.get("inserted", [])
    merged_deleted  = diff1.get("deleted",  []) + diff2.get("deleted",  [])

    upd_map: Dict[Any, Dict[str, Any]] = {}
    for diff in (diff1, diff2):
        for upd in diff.get("updated", []):
            rid = upd["id"]
            changes = upd["changes"]
            if rid not in upd_map:
                upd_map[rid] = {"id": rid, "changes": changes.copy()}
            else:
                existing = upd_map[rid]["changes"]
                for field, ch in changes.items():
                    if field in existing:
                        existing[field]["new"] = ch["new"]
                    else:
                        existing[field] = ch

    merged_updated = list(upd_map.values())

    return {
        "inserted": merged_inserted,
        "deleted":  merged_deleted,
        "updated":  merged_updated
    }

def restore_diff(repo: BaseRepository, model_class: BaseDataclass, diff_to_restore: Dict[str, Any]) -> Dict[str, Any]:
    diff = {"inserted": [], "deleted": [], "updated": []}

    for update in diff_to_restore.get("updated", []):
        row_id = update["id"]
        current_row = repo.find_one({"id": row_id})
        if current_row:
            revert_updates = {}
            for field, change in update["changes"].items():
                old_value = change["old"]
                current_value = current_row[field]
                if current_value != old_value:
                    revert_updates[field] = old_value
            if revert_updates:
                updated_rows = repo.update_returning({"id": row_id}, revert_updates)
                for row in updated_rows:
                    changes = {field: {"old": current_row[field], "new": row[field]} for field in revert_updates}
                    diff["updated"].append({"id": row["id"], "changes": changes})

    inserted_ids = [row["id"] for row in diff_to_restore.get("inserted", [])]
    if inserted_ids:
        deleted_rows = repo.delete_returning({"id": inserted_ids})
        diff["deleted"].extend(deleted_rows)

    for deleted_row in diff_to_restore.get("deleted", []):
        entry = model_class(**deleted_row)
        inserted_row = repo.insert_returning(entry)
        diff["inserted"].append(inserted_row)

    return diff

def process_keyword_table_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    action_type = action["type"]
    diff = {"inserted": [], "deleted": [], "updated": []}

    if action_type == "INITIALIZE":
        diff["deleted"] = keyword_entries_repo.delete_returning({"coding_context_id": workspace_id})
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
            inserted_row = keyword_entries_repo.insert_returning(entry)
            diff["inserted"].append(inserted_row)

    elif action_type == "SET_ALL_CORRECT":
        old_rows = keyword_entries_repo.find({"coding_context_id": workspace_id}, columns=["id", "is_marked"])
        old_is_marked = {row["id"]: row["is_marked"] for row in old_rows}
        updated_rows = keyword_entries_repo.update_returning({"coding_context_id": workspace_id}, {"is_marked": True})
        diff["updated"] = [
            {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": True}}}
            for row in updated_rows if old_is_marked.get(row["id"]) != True
        ]

    elif action_type == "SET_ALL_INCORRECT":
        old_rows = keyword_entries_repo.find({"coding_context_id": workspace_id}, columns=["id", "is_marked"])
        old_is_marked = {row["id"]: row["is_marked"] for row in old_rows}
        updated_rows = keyword_entries_repo.update_returning({"coding_context_id": workspace_id}, {"is_marked": False})
        diff["updated"] = [
            {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": False}}}
            for row in updated_rows if old_is_marked.get(row["id"]) != False
        ]

    elif action_type == "SET_ALL_UNMARKED":
        old_rows = keyword_entries_repo.find({"coding_context_id": workspace_id}, columns=["id", "is_marked"])
        old_is_marked = {row["id"]: row["is_marked"] for row in old_rows}
        updated_rows = keyword_entries_repo.update_returning({"coding_context_id": workspace_id}, {"is_marked": None})
        diff["updated"] = [
            {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": None}}}
            for row in updated_rows if old_is_marked.get(row["id"]) is not None
        ]

    elif action_type == "ADD_MANY":
        current_entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        existing_words = {entry.word for entry in current_entries}
        new_entries = [entry for entry in action["entries"] if entry["word"] not in existing_words]
        diff["deleted"] = keyword_entries_repo.delete_returning({"coding_context_id": workspace_id, "is_marked": [False, None]})
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
            inserted_row = keyword_entries_repo.insert_returning(entry)
            diff["inserted"].append(inserted_row)

    elif action_type == "UPDATE_FIELD":
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            old_value = getattr(entry, action["field"])
            updated_rows = keyword_entries_repo.update_returning(
                {"id": entry.id},
                {action["field"]: action["value"]}
            )
            if updated_rows:
                diff["updated"] = [{
                    "id": updated_rows[0]["id"],
                    "changes": {action["field"]: {"old": old_value, "new": updated_rows[0][action["field"]]}}
                }]

    elif action_type == "TOGGLE_MARK":
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            old_is_marked = entry.is_marked
            updated_rows = keyword_entries_repo.update_returning(
                {"id": entry.id},
                {"is_marked": action["isMarked"]}
            )
            if updated_rows:
                diff["updated"] = [{
                    "id": updated_rows[0]["id"],
                    "changes": {"is_marked": {"old": old_is_marked, "new": updated_rows[0]["is_marked"]}}
                }]

    elif action_type == "ADD_ROW":
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
        inserted_row = keyword_entries_repo.insert_returning(entry)
        diff["inserted"].append(inserted_row)

    elif action_type == "UNDO_DELETE_ROW":
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
        inserted_row = keyword_entries_repo.insert_returning(entry)
        diff["inserted"].append(inserted_row)

    elif action_type == "DELETE_ROW":
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        print(f"Deleting row at index {action['index']} from entries: {entries}")
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            diff["deleted"] = keyword_entries_repo.delete_returning({"id": entry.id})

    elif action_type == "RESET":
        diff["deleted"] = keyword_entries_repo.delete_returning({"coding_context_id": workspace_id})

    elif action_type == "RESTORE_STATE":
        diff["deleted"] = keyword_entries_repo.delete_returning({"coding_context_id": workspace_id})
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
            inserted_row = keyword_entries_repo.insert_returning(entry)
            diff["inserted"].append(inserted_row)

    elif action_type == "RESTORE_DIFF":
        diff = restore_diff(keyword_entries_repo, KeywordEntry, action["payload"])

    else:
        raise ValueError(f"Unknown action type: {action_type}")

    return diff

def process_initial_codebook_table_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    action_type = action.get("type")
    diff = {"inserted": [], "deleted": [], "updated": []}
    if not action_type:
        raise HTTPException(status_code=400, detail="Action type is required")

    filters = {"coding_context_id": workspace_id}

    if action_type == "INITIALIZE":
        diff["deleted"] = initial_codebook_repo.delete_returning(filters)
        for entry_data in action.get("entries", []):
            entry = InitialCodebookEntry(
                id=str(uuid4()),
                coding_context_id=workspace_id,
                code=entry_data["code"],
                definition=entry_data["definition"]
            )
            inserted_row = initial_codebook_repo.insert_returning(entry)
            diff["inserted"].append(inserted_row)

    elif action_type == "ADD_MANY":
        existing_codes = {entry.code for entry in initial_codebook_repo.find(filters)}
        new_entries = [entry for entry in action.get("entries", []) if entry["code"] not in existing_codes]
        for entry_data in new_entries:
            entry = InitialCodebookEntry(
                id=str(uuid4()),
                coding_context_id=workspace_id,
                code=entry_data["code"],
                definition=entry_data["definition"]
            )
            inserted_row = initial_codebook_repo.insert_returning(entry)
            diff["inserted"].append(inserted_row)

    elif action_type == "UPDATE_FIELD":
        index = action.get("index")
        field = action.get("field")
        value = action.get("value")
        if not all([index is not None, field, value is not None]):
            raise HTTPException(status_code=400, detail="index, field, and value required for UPDATE_FIELD")
        entries = initial_codebook_repo.find(filters)
        if 0 <= index < len(entries):
            entry_id = entries[index].id
            old_entry = initial_codebook_repo.find_one({"id": entry_id})
            old_value = getattr(old_entry, field)
            updated_rows = initial_codebook_repo.update_returning({"id": entry_id}, {field: value})
            if updated_rows:
                diff["updated"] = [{
                    "id": updated_rows[0]["id"],
                    "changes": {field: {"old": old_value, "new": updated_rows[0][field]}}
                }]
        else:
            raise HTTPException(status_code=400, detail="Invalid index")

    elif action_type == "ADD_ROW":
        entry_data = action.get("entry", {})
        new_entry = InitialCodebookEntry(
            id=str(uuid4()),
            coding_context_id=workspace_id,
            code=entry_data.get("code", ""),
            definition=entry_data.get("definition", "")
        )
        inserted_row = initial_codebook_repo.insert_returning(new_entry)
        diff["inserted"].append(inserted_row)

    elif action_type == "RESET":
        diff["deleted"] = initial_codebook_repo.delete_returning(filters)

    elif action_type == "RESTORE_STATE":
        diff["deleted"] = initial_codebook_repo.delete_returning(filters)
        for entry_data in action.get("payload", []):
            entry = InitialCodebookEntry(
                id=str(uuid4()),
                coding_context_id=workspace_id,
                code=entry_data["code"],
                definition=entry_data["definition"]
            )
            inserted_row = initial_codebook_repo.insert_returning(entry)
            diff["inserted"].append(inserted_row)

    elif action_type == "RESTORE_DIFF":
        diff = restore_diff(initial_codebook_repo, InitialCodebookEntry, action["payload"])

    else:
        print(f"Unknown action type: {action_type}")

    return diff

def process_grouped_codes_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    action_type = action.get("type")
    diff = {"inserted": [], "deleted": [], "updated": []}
    if not action_type:
        raise ValueError("Action type is required")

    filters = {"coding_context_id": workspace_id}

    if action_type == "ADD_BUCKET":
        bucket_id = str(uuid4())
        inserted_row = grouped_code_repo.insert_returning(
            GroupedCodeEntry(
                coding_context_id=workspace_id,
                higher_level_code="New Bucket",
                higher_level_code_id=bucket_id,
                code=None,
            )
        )
        diff["inserted"].append(inserted_row)

    elif action_type == "DELETE_BUCKET":
        bucket_id = action.get("payload")
        if not bucket_id:
            raise ValueError("Bucket ID is required for DELETE_BUCKET")
        old_rows = grouped_code_repo.find({"coding_context_id": workspace_id, "higher_level_code_id": bucket_id})
        old_values = {row["id"]: {"higher_level_code": row["higher_level_code"], "higher_level_code_id": row["higher_level_code_id"]} for row in old_rows}
        updated_rows = grouped_code_repo.update_returning(
            {"coding_context_id": workspace_id, "higher_level_code_id": bucket_id},
            {"higher_level_code": None, "higher_level_code_id": None}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "higher_level_code": {"old": old_values.get(row["id"], {}).get("higher_level_code"), "new": None},
                    "higher_level_code_id": {"old": old_values.get(row["id"], {}).get("higher_level_code_id"), "new": None}
                }
            } for row in updated_rows
        ]

    elif action_type == "MOVE_CODE":
        payload = action.get("payload")
        print(f"Payload for MOVE_CODE: {payload}")
        if not payload or "code" not in payload or "targetBucketId" not in payload:
            raise ValueError("code, targetBucketId are required for MOVE_CODE")
        code = payload["code"]
        target_bucket_id = payload["targetBucketId"]
        target_bucket = grouped_code_repo.find_one({"higher_level_code_id": target_bucket_id})
        if not target_bucket:
            raise ValueError(f"Target bucket with ID {target_bucket_id} does not exist")
        old_rows = grouped_code_repo.find({"coding_context_id": workspace_id, "code": code})
        old_values = {row["id"]: {"higher_level_code": row["higher_level_code"], "higher_level_code_id": row["higher_level_code_id"]} for row in old_rows}
        updated_rows = grouped_code_repo.update_returning(
            {"coding_context_id": workspace_id, "code": code},
            {"higher_level_code_id": target_bucket_id, "higher_level_code": target_bucket.higher_level_code}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "higher_level_code": {"old": old_values.get(row["id"], {}).get("higher_level_code"), "new": row["higher_level_code"]},
                    "higher_level_code_id": {"old": old_values.get(row["id"], {}).get("higher_level_code_id"), "new": row["higher_level_code_id"]}
                }
            } for row in updated_rows
        ]

    elif action_type == "MOVE_UNPLACED_TO_MISC":
        print(f"Payload for MOVE_UNPLACED_TO_MISC")
        misc_bucket_id = "miscellaneous"
        misc_bucket_name = "Miscellaneous"
        old_rows = grouped_code_repo.find({"coding_context_id": workspace_id, "higher_level_code_id": None, "higher_level_code": None})
        old_values = {row["id"]: {"higher_level_code": row["higher_level_code"], "higher_level_code_id": row["higher_level_code_id"]} for row in old_rows}
        updated_rows = grouped_code_repo.update_returning(
            {"coding_context_id": workspace_id, "higher_level_code_id": None, "higher_level_code": None},
            {"higher_level_code": misc_bucket_name, "higher_level_code_id": misc_bucket_id}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "higher_level_code": {"old": old_values.get(row["id"], {}).get("higher_level_code"), "new": misc_bucket_name},
                    "higher_level_code_id": {"old": old_values.get(row["id"], {}).get("higher_level_code_id"), "new": misc_bucket_id}
                }
            } for row in updated_rows
        ]

    elif action_type == "UPDATE_BUCKET_NAME":
        payload = action.get("payload")
        if not payload or "bucketId" not in payload or "newName" not in payload:
            raise ValueError("bucketId and newName are required for UPDATE_BUCKET_NAME")
        bucket_id = payload["bucketId"]
        new_name = payload["newName"]
        old_rows = grouped_code_repo.find({"coding_context_id": workspace_id, "higher_level_code_id": bucket_id})
        old_values = {row["id"]: {"higher_level_code": row["higher_level_code"]} for row in old_rows}
        updated_rows = grouped_code_repo.update_returning(
            {"coding_context_id": workspace_id, "higher_level_code_id": bucket_id},
            {"higher_level_code": new_name}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {"higher_level_code": {"old": old_values.get(row["id"], {}).get("higher_level_code"), "new": new_name}}
            } for row in updated_rows
        ]

    elif action_type == "RESTORE_STATE":
        payload = action.get("payload")
        if not payload:
            raise ValueError("Payload is required for RESTORE_STATE")
        old_rows = grouped_code_repo.find({"coding_context_id": workspace_id})
        old_values = {row["id"]: {"higher_level_code": row["higher_level_code"], "higher_level_code_id": row["higher_level_code_id"]} for row in old_rows}
        updated_rows = grouped_code_repo.update_returning(
            {"coding_context_id": workspace_id},
            {"higher_level_code": None, "higher_level_code_id": None}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "higher_level_code": {"old": old_values.get(row["id"], {}).get("higher_level_code"), "new": None},
                    "higher_level_code_id": {"old": old_values.get(row["id"], {}).get("higher_level_code_id"), "new": None}
                }
            } for row in updated_rows if old_values.get(row["id"], {}).get("higher_level_code") is not None or old_values.get(row["id"], {}).get("higher_level_code_id") is not None
        ]
        for bucket_data in payload:
            if bucket_data.get("id") is not None:
                bucket_id = bucket_data["id"]
                bucket_name = bucket_data["name"]
                codes = bucket_data.get("codes", [])
                for code in codes:
                    old_rows = grouped_code_repo.find({"coding_context_id": workspace_id, "code": code})
                    old_values = {row["id"]: {"higher_level_code": row["higher_level_code"], "higher_level_code_id": row["higher_level_code_id"]} for row in old_rows}
                    updated_rows = grouped_code_repo.update_returning(
                        {"coding_context_id": workspace_id, "code": code},
                        {"higher_level_code": bucket_name, "higher_level_code_id": bucket_id}
                    )
                    diff["updated"].extend([
                        {
                            "id": row["id"],
                            "changes": {
                                "higher_level_code": {"old": old_values.get(row["id"], {}).get("higher_level_code"), "new": bucket_name},
                                "higher_level_code_id": {"old": old_values.get(row["id"], {}).get("higher_level_code_id"), "new": bucket_id}
                            }
                        } for row in updated_rows
                    ])
    
    elif action_type == "RESTORE_DIFF":
        diff = restore_diff(grouped_code_repo, GroupedCodeEntry, action["payload"])

    else:
        raise ValueError(f"Unknown action type: {action_type}")

    return diff

def process_themes_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    action_type = action.get("type")
    diff = {"inserted": [], "deleted": [], "updated": []}
    if not action_type:
        raise ValueError("Action type is required")

    if action_type == "ADD_THEME":
        theme_id = str(uuid4())
        inserted_row = themes_repo.insert_returning(
            ThemeEntry(
                coding_context_id=workspace_id,
                theme="New Theme",
                theme_id=theme_id,
                higher_level_code=None,
            )
        )
        diff["inserted"].append(inserted_row)

    elif action_type == "DELETE_THEME":
        theme_id = action.get("payload")
        if not theme_id:
            raise ValueError("Theme ID is required for DELETE_THEME")
        old_rows = themes_repo.find({"coding_context_id": workspace_id, "theme_id": theme_id})
        old_values = {row["id"]: {"theme": row["theme"], "theme_id": row["theme_id"]} for row in old_rows}
        updated_rows = themes_repo.update_returning(
            {"coding_context_id": workspace_id, "theme_id": theme_id},
            {"theme": None, "theme_id": None}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "theme": {"old": old_values.get(row["id"], {}).get("theme"), "new": None},
                    "theme_id": {"old": old_values.get(row["id"], {}).get("theme_id"), "new": None}
                }
            } for row in updated_rows
        ]

    elif action_type == "MOVE_CODE_TO_THEME":
        payload = action.get("payload")
        if not payload or "code" not in payload or "targetThemeId" not in payload:
            raise ValueError("code, targetThemeId, and targetThemeName are required for MOVE_CODE_TO_THEME")
        code = payload["code"]
        target_theme_id = payload["targetThemeId"]
        target_bucket = themes_repo.find_one({"theme_id": target_theme_id}, fail_silently=True)
        if not target_bucket:
            raise ValueError(f"Target theme with ID {target_theme_id} does not exist")
        old_rows = themes_repo.find({"coding_context_id": workspace_id, "higher_level_code": code})
        old_values = {row["id"]: {"theme": row["theme"], "theme_id": row["theme_id"]} for row in old_rows}
        updated_rows = themes_repo.update_returning(
            {"coding_context_id": workspace_id, "higher_level_code": code},
            {"theme": target_bucket.theme, "theme_id": target_theme_id}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "theme": {"old": old_values.get(row["id"], {}).get("theme"), "new": target_bucket.theme},
                    "theme_id": {"old": old_values.get(row["id"], {}).get("theme_id"), "new": target_theme_id}
                }
            } for row in updated_rows
        ]

    elif action_type == "MOVE_UNPLACED_TO_MISC":
        misc_theme_id = "miscellaneous"
        misc_theme_name = "Miscellaneous"
        old_rows = themes_repo.find({"coding_context_id": workspace_id, "theme_id": None})
        old_values = {row["id"]: {"theme": row["theme"], "theme_id": row["theme_id"]} for row in old_rows}
        updated_rows = themes_repo.update_returning(
            {"coding_context_id": workspace_id, "theme_id": None},
            {"theme": misc_theme_name, "theme_id": misc_theme_id}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "theme": {"old": old_values.get(row["id"], {}).get("theme"), "new": misc_theme_name},
                    "theme_id": {"old": old_values.get(row["id"], {}).get("theme_id"), "new": misc_theme_id}
                }
            } for row in updated_rows
        ]

    elif action_type == "UPDATE_THEME_NAME":
        payload = action.get("payload")
        if not payload or "themeId" not in payload or "newName" not in payload:
            raise ValueError("themeId and newName are required for UPDATE_THEME_NAME")
        theme_id = payload["themeId"]
        new_name = payload["newName"]
        old_rows = themes_repo.find({"coding_context_id": workspace_id, "theme_id": theme_id})
        old_values = {row["id"]: {"theme": row["theme"]} for row in old_rows}
        updated_rows = themes_repo.update_returning(
            {"coding_context_id": workspace_id, "theme_id": theme_id},
            {"theme": new_name}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {"theme": {"old": old_values.get(row["id"], {}).get("theme"), "new": new_name}}
            } for row in updated_rows
        ]

    elif action_type == "RESTORE_STATE":
        payload = action.get("payload")
        if not payload:
            raise ValueError("Payload is required for RESTORE_STATE")
        old_rows = themes_repo.find({"coding_context_id": workspace_id})
        old_values = {row["id"]: {"theme": row["theme"], "theme_id": row["theme_id"]} for row in old_rows}
        updated_rows = themes_repo.update_returning(
            {"coding_context_id": workspace_id},
            {"theme": None, "theme_id": None}
        )
        diff["updated"] = [
            {
                "id": row["id"],
                "changes": {
                    "theme": {"old": old_values.get(row["id"], {}).get("theme"), "new": None},
                    "theme_id": {"old": old_values.get(row["id"], {}).get("theme_id"), "new": None}
                }
            } for row in updated_rows if old_values.get(row["id"], {}).get("theme") is not None or old_values.get(row["id"], {}).get("theme_id") is not None
        ]
        for theme_data in payload:
            if theme_data.get("id") is not None:
                theme_id = theme_data["id"]
                theme_name = theme_data["name"]
                codes = theme_data.get("codes", [])
                for code in codes:
                    old_rows = themes_repo.find({"coding_context_id": workspace_id, "higher_level_code": code})
                    old_values = {row["id"]: {"theme": row["theme"], "theme_id": row["theme_id"]} for row in old_rows}
                    updated_rows = themes_repo.update_returning(
                        {"coding_context_id": workspace_id, "higher_level_code": code},
                        {"theme": theme_name, "theme_id": theme_id}
                    )
                    diff["updated"].extend([
                        {
                            "id": row["id"],
                            "changes": {
                                "theme": {"old": old_values.get(row["id"], {}).get("theme"), "new": theme_name},
                                "theme_id": {"old": old_values.get(row["id"], {}).get("theme_id"), "new": theme_id}
                            }
                        } for row in updated_rows
                    ])

    elif action_type == "RESTORE_DIFF":
        diff = restore_diff(themes_repo, ThemeEntry, action["payload"])

    else:
        raise ValueError(f"Unknown action type: {action_type}")

    return diff

def process_action(
    workspace_id: str,
    action: Dict[str, Any],
    codebook_type: str,
    default_response_type: str,
    use_index: bool = True,
    strict_action_type: bool = False,
    force: bool = False,
) -> Dict[str, Any]:
    settings = CustomSettings()
    action_type = action.get("type")
    diff = {"inserted": [], "deleted": [], "updated": []}
    
    if strict_action_type and not action_type:
        raise HTTPException(status_code=400, detail="Action type is required")

    base_filters = {
        "workspace_id": workspace_id,
        "codebook_type": codebook_type
    }

    print(f"Processing action: {action_type} for workspace: {workspace_id}", action)

    def update_response(identifier: Any, updates: Dict[str, Any]) -> None:
        old_rows = qect_repo.find(identifier)
        old_values = {row["id"]: {k: row[k] for k in updates.keys()} for row in old_rows}
        updated_rows = qect_repo.update_returning(identifier, updates)
        diff["updated"].extend([
            {
                "id": row["id"],
                "changes": {field: {"old": old_values.get(row["id"], {}).get(field), "new": row[field]} for field in updates}
            } for row in updated_rows
        ])

    if action_type == "SET_CORRECT":
        updates = {"is_correct": True, "comment": "", "is_marked": True}
        update_response({"id": action["index"]}, updates)

    elif action_type == "SET_ALL_CORRECT":
        if force:
            updated_rows = qect_repo.update_returning({
                "workspace_id": workspace_id,
                "codebook_type": [CodebookType.INITIAL.value, CodebookType.FINAL.value],
            }, {"is_marked": True})
            diff["updated"] = [
                {"id": row["id"], "changes": {"is_marked": {"old": None, "new": True}}}
                for row in updated_rows if row["is_marked"] is None
            ]
            
        else:
            result = qect_repo.execute_raw_query("SELECT is_marked FROM qect WHERE workspace_id = ? AND codebook_type = ? GROUP BY is_marked;", (workspace_id, codebook_type), keys=True)
            true_count = sum(1 for row in result if row['is_marked'])
            old_rows = qect_repo.find(base_filters)
            old_is_marked = {row["id"]: row["is_marked"] for row in old_rows}
            if true_count < len(result):
                print(f"Setting all responses to correct for workspace: {workspace_id}")
                updated_rows = qect_repo.update_returning(base_filters, {"is_marked": True})
                diff["updated"] = [
                    {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": True}}}
                    for row in updated_rows if old_is_marked.get(row["id"]) != True
                ]
            else:
                print(f"Setting all responses to unmarked for workspace: {workspace_id}")
                updated_rows = qect_repo.update_returning(base_filters, {"is_marked": None})
                diff["updated"] = [
                    {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": None}}}
                    for row in updated_rows if old_is_marked.get(row["id"]) is not None
                ]

    elif action_type == "SET_INCORRECT":
        updates = {"is_marked": False}
        update_response({"id": action["index"]}, updates)

    elif action_type == "SET_ALL_INCORRECT":
        if force:
            updated_rows = qect_repo.update_returning({
                "workspace_id": workspace_id,
                "codebook_type": [CodebookType.INITIAL.value, CodebookType.FINAL.value],
            }, {"is_marked": False})
            diff["updated"] = [
                {"id": row["id"], "changes": {"is_marked": {"old": None, "new": True}}}
                for row in updated_rows if row["is_marked"] is None
            ]
            
        else:
            result = qect_repo.execute_raw_query("SELECT is_marked FROM qect WHERE workspace_id = ? AND codebook_type = ? GROUP BY is_marked;", (workspace_id, codebook_type), keys=True)
            false_count = sum(1 for row in result if row['is_marked'] == 0)
            old_rows = qect_repo.find(base_filters)
            old_is_marked = {row["id"]: row["is_marked"] for row in old_rows}
            if false_count < len(result):
                print(f"Setting all responses to incorrect for workspace: {workspace_id}")
                updated_rows = qect_repo.update_returning(base_filters, {"is_marked": False})
                diff["updated"] = [
                    {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": False}}}
                    for row in updated_rows if old_is_marked.get(row["id"]) != False
                ]
            else:
                print(f"Setting all responses to unmarked for workspace: {workspace_id}")
                updated_rows = qect_repo.update_returning(base_filters, {"is_marked": None})
                diff["updated"] = [
                    {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": None}}}
                    for row in updated_rows if old_is_marked.get(row["id"]) is not None
                ]

    elif action_type == "SET_ALL_UNMARKED":
        print(f"Setting all responses to unmarked for workspace: {workspace_id}")
        old_rows = qect_repo.find(base_filters)
        old_is_marked = {row["id"]: row["is_marked"] for row in old_rows}
        updated_rows = qect_repo.update_returning(base_filters, {"is_marked": None})
        diff["updated"] = [
            {"id": row["id"], "changes": {"is_marked": {"old": old_is_marked.get(row["id"]), "new": None}}}
            for row in updated_rows if old_is_marked.get(row["id"]) is not None
        ]

    elif action_type == "UPDATE_COMMENT":
        comment = action.get("comment")
        update_response({"id": action["index"]}, {"comment": comment})

    elif action_type == "MARK_RESPONSE":
        is_marked = action.get("isMarked")
        update_response({"id": action["index"]}, {"is_marked": is_marked})

    elif action_type == "MARK_RESPONSE_BY_CODE_EXPLANATION":
        code = action.get("code")
        quote = action.get("quote")
        post_id = action.get("postId")
        is_marked = action.get("isMarked")
        update_response({**base_filters, "code": code, "quote": quote, "post_id": post_id}, {"is_marked": is_marked})

    elif action_type == "ADD_RESPONSE":
        response_data = action.get("response")
        if response_data["code"].strip() and response_data["quote"].strip():
            new_response = QectResponse(
                id=str(uuid4()),
                dataset_id=response_data.get("datasetId", workspace_id),
                workspace_id=workspace_id,
                model=response_data.get("model", settings.ai.model),
                quote=response_data["quote"],
                code=response_data["code"],
                explanation=response_data["explanation"],
                post_id=response_data["postId"],
                codebook_type=codebook_type,
                response_type=response_data.get("responseType", default_response_type),
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", None if codebook_type != CodebookType.FINAL else True),
                created_at=datetime.now()
            )
            inserted_row = qect_repo.insert_returning(new_response)
            diff["inserted"].append(inserted_row)

    elif action_type == "SET_RESPONSES":
        diff["deleted"] = qect_repo.delete_returning(base_filters)
        new_responses = [
            r for r in (action.get("responses") or [])
            if r["code"].strip() and r["quote"].strip()
        ]
        for response_data in new_responses:
            new_response = QectResponse(
                id=response_data.get("id", str(uuid4())),
                dataset_id=response_data.get("datasetId", workspace_id),
                workspace_id=workspace_id,
                model=response_data.get("model", settings.ai.model),
                quote=response_data["quote"],
                code=response_data["code"],
                explanation=response_data["explanation"],
                post_id=response_data["postId"],
                codebook_type=codebook_type,
                response_type=response_data.get("responseType", default_response_type),
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", None if codebook_type != CodebookType.FINAL else True),
                created_at=datetime.now()
            )
            inserted_row = qect_repo.insert_returning(new_response)
            diff["inserted"].append(inserted_row)

    elif action_type == "SET_PARTIAL_RESPONSES":
        new_responses = [
            r for r in (action.get("responses") or [])
            if r["code"].strip() and r["quote"].strip()
        ]
        diff["deleted"] = qect_repo.delete_returning({**base_filters, "post_id": [r["postId"] for r in new_responses]})
        for response_data in new_responses:
            new_response = QectResponse(
                id=response_data.get("id", str(uuid4())),
                dataset_id=response_data.get("datasetId", workspace_id),
                workspace_id=workspace_id,
                model=response_data.get("model", settings.ai.model),
                quote=response_data["quote"],
                code=response_data["code"],
                explanation=response_data["explanation"],
                post_id=response_data["postId"],
                codebook_type=codebook_type,
                response_type=response_data.get("responseType", default_response_type),
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", None if codebook_type != CodebookType.FINAL else True),
                created_at=datetime.now()
            )
            inserted_row = qect_repo.insert_returning(new_response)
            diff["inserted"].append(inserted_row)

    elif action_type == "ADD_RESPONSES":
        new_responses = [
            r for r in (action.get("responses") or [])
            if r["code"].strip() and r["quote"].strip()
        ]
        for response_data in new_responses:
            new_response = QectResponse(
                id=str(uuid4()),
                dataset_id=response_data.get("datasetId", workspace_id),
                workspace_id=workspace_id,
                model=response_data.get("model", settings.ai.model),
                quote=response_data["quote"],
                code=response_data["code"],
                explanation=response_data["explanation"],
                post_id=response_data["postId"],
                codebook_type=codebook_type,
                response_type=response_data.get("responseType", default_response_type),
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", None if codebook_type != CodebookType.FINAL else True),
                created_at=datetime.now()
            )
            inserted_row = qect_repo.insert_returning(new_response)
            diff["inserted"].append(inserted_row)

    elif action_type == "REMOVE_RESPONSES":
        if action.get("all"):
            diff["deleted"] = qect_repo.delete_returning(base_filters)
        elif "indexes" in action and use_index:
            indexes = action["indexes"]
            if len(indexes):
                diff["deleted"] = qect_repo.delete_returning({"id": indexes})
        elif "responseIds" in action and not use_index:
            response_ids = action["responseIds"]
            diff["deleted"] = qect_repo.delete_returning({"id": response_ids})

    elif action_type == "DELETE_CODE":
        code = action.get("code")
        diff["deleted"] = qect_repo.delete_returning({**base_filters, "code": code})

    elif action_type == "EDIT_CODE":
        current_code = action.get("currentCode")
        new_code = action.get("newCode")
        update_response({**base_filters, "code": current_code}, {"code": new_code})

    elif action_type == "DELETE_HIGHLIGHT":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        diff["deleted"] = qect_repo.delete_returning({**base_filters, "post_id": post_id, "quote": sentence, "code": code})

    elif action_type == "EDIT_HIGHLIGHT":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        new_sentence = action.get("newSentence")
        range_marker = action.get("rangeMarker")
        updates = {"quote": new_sentence}
        if range_marker is not None:
            updates["range_marker"] = json.dumps(range_marker)
        update_response({**base_filters, "post_id": post_id, "quote": sentence, "code": code}, updates)

    elif action_type == "SET_CHAT_HISTORY":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        chat_history = json.dumps(action.get("chatHistory"))
        update_response({**base_filters, "post_id": post_id, "quote": sentence, "code": code}, {"chat_history": chat_history})

    elif action_type == "UPDATE_CODE":
        quote = action.get("quote")
        prev_code = action.get("prevCode")
        new_code = action.get("newCode")
        update_response({**base_filters, "quote": quote, "code": prev_code}, {"code": new_code})

    elif action_type == "UPSERT_MARKER":
        code = action.get("code")
        quote = action.get("quote")
        post_id = action.get("postId")
        range_marker = action.get("rangeMarker")
        update_response({**base_filters, "code": code, "quote": quote, "post_id": post_id}, {"range_marker": range_marker})

    elif action_type == "SYNC_CHAT_STATE":
        post_id = action.get("postId")
        quote = action.get("quote")
        prev_code = action.get("prevCode")
        current_code = action.get("currentCode")
        chat_history = action.get("chatHistory")
        is_marked = action.get("isMarked")
        refresh = action.get("refresh", False)
        filters = {**base_filters, "post_id": post_id, "quote": quote, "code": prev_code}
        responses = qect_repo.find(filters)
        if responses:
            response = responses[0]
            updates = {}
            if chat_history is not None:
                updates["chat_history"] = json.dumps(chat_history)
            if current_code and current_code.strip():
                updates["code"] = current_code
            if is_marked is not None:
                updates["is_marked"] = is_marked
            if refresh and "chat_history" in updates:
                chat_history = json.loads(updates["chat_history"])
                chat_history = [
                    {**msg, "reaction": None, "isThinking": False} if msg["sender"] == "LLM" else msg
                    for msg in chat_history if not (msg["sender"] == "Human" and msg.get("isEditable"))
                ]
                updates["chat_history"] = json.dumps(chat_history)
            if updates:
                update_response({"id": response.id}, updates)

    elif action_type == "RESET":
        diff["deleted"] = qect_repo.delete_returning(base_filters)

    elif action_type == "RESTORE_STATE":
        for response_data in action.get("payload", []):
            response_id = response_data.get("id")
            if response_id:
                existing = qect_repo.find_one({"id": response_id})
                if existing:
                    updates = {
                        "dataset_id": response_data.get("datasetId", existing.dataset_id),
                        "model": response_data.get("model", existing.model),
                        "quote": response_data.get("quote", existing.quote),
                        "code": response_data.get("code", existing.code),
                        "explanation": response_data.get("explanation", existing.explanation),
                        "post_id": response_data.get("postId", existing.post_id),
                        "response_type": response_data.get("responseType", existing.response_type),
                        "codebook_type": response_data.get("codebookType", codebook_type),
                        "chat_history": json.dumps(response_data["chatHistory"]) if "chatHistory" in response_data else existing.chat_history,
                        "is_marked": response_data.get("isMarked", existing.is_marked),
                        "range_marker": response_data.get("rangeMarker", existing.range_marker),
                    }
                    update_response({"id": response_id}, updates)
                else:
                    new_response = QectResponse(
                        id=response_id,
                        dataset_id=response_data.get("datasetId", workspace_id),
                        workspace_id=workspace_id,
                        model=response_data.get("model", settings.ai.model),
                        quote=response_data.get("quote", ""),
                        code=response_data.get("code", ""),
                        explanation=response_data.get("explanation", ""),
                        post_id=response_data.get("postId", ""),
                        codebook_type=codebook_type,
                        response_type=response_data.get("responseType", default_response_type),
                        chat_history=json.dumps(response_data.get("chatHistory", None)),
                        is_marked=response_data.get("isMarked", None),
                        created_at=datetime.now()
                    )
                    inserted_row = qect_repo.insert_returning(new_response)
                    diff["inserted"].append(inserted_row)

    elif action_type == "RESTORE_DIFF":
        diff = restore_diff(qect_repo, QectResponse, action["payload"])

    elif action_type == "RERUN_CODING":
        pass

    else:
        print(f"Unknown action type: {action_type}")

    return diff

def process_sampled_post_response_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    return process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.INITIAL.value,
        default_response_type=ResponseCreatorType.LLM.value,
        use_index=True,
        strict_action_type=False
    )

def process_unseen_post_response_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    return process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.FINAL.value,
        default_response_type=ResponseCreatorType.LLM.value,
        use_index=False,
        strict_action_type=True
    )

def process_manual_coding_responses_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    return process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.MANUAL.value,
        default_response_type=ResponseCreatorType.HUMAN.value,
        use_index=True,
        strict_action_type=False
    )

def process_all_responses_action(workspace_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
    initial_diff = process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.INITIAL.value,
        default_response_type=ResponseCreatorType.LLM.value,
        use_index=True,
        strict_action_type=False,
        force=True
    )
    final_diff = process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.FINAL.value,
        default_response_type=ResponseCreatorType.LLM.value,
        use_index=False,
        strict_action_type=True,
        force=True
    )
    return merge_diffs(initial_diff, final_diff)