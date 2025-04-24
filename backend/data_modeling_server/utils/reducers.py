from datetime import datetime
import json
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import HTTPException
from sympy import false
from config import CustomSettings
from database.grouped_code_table import GroupedCodeEntriesRepository
from database.initial_codebook_table import InitialCodebookEntriesRepository
from database.keyword_entry_table import KeywordEntriesRepository
from database.qect_table import QectRepository
from database.theme_table import ThemeEntriesRepository
from models.table_dataclasses import CodebookType, GroupedCodeEntry, InitialCodebookEntry, KeywordEntry, QectResponse, ResponseCreatorType, ThemeEntry


keyword_entries_repo = KeywordEntriesRepository()
qect_repo = QectRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()
grouped_code_repo = GroupedCodeEntriesRepository()
themes_repo = ThemeEntriesRepository()

def process_keyword_table_action(workspace_id: str, action: Dict[str, Any]) -> None:
    action_type = action["type"]

    if action_type == "INITIALIZE":
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
        keyword_entries_repo.update({"coding_context_id": workspace_id}, {"is_marked": True})

    elif action_type == "SET_ALL_INCORRECT":
        keyword_entries_repo.update({"coding_context_id": workspace_id}, {"is_marked": False})

    elif action_type == "SET_ALL_UNMARKED":
        keyword_entries_repo.update({"coding_context_id": workspace_id}, {"is_marked": None})

    elif action_type == "ADD_MANY":
        current_entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        existing_words = {entry.word for entry in current_entries}
        new_entries = [entry for entry in action["entries"] if entry["word"] not in existing_words]
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
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            keyword_entries_repo.update(
                {"id": entry.id},
                {action["field"]: action["value"]}
            )

    elif action_type == "TOGGLE_MARK":
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            keyword_entries_repo.update(
                {"id": entry.id},
                {"is_marked": action["isMarked"]}
            )

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
        keyword_entries_repo.insert(entry)

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
        keyword_entries_repo.insert(entry)

    elif action_type == "DELETE_ROW":
        entries = keyword_entries_repo.find({"coding_context_id": workspace_id})
        print(f"Deleting row at index {action['index']} from entries: {entries}")
        if 0 <= action["index"] < len(entries):
            entry = entries[action["index"]]
            keyword_entries_repo.delete({"id": entry.id})

    elif action_type == "RESET":
        keyword_entries_repo.delete({"coding_context_id": workspace_id})

    elif action_type == "RESTORE_STATE":
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
    

# def process_sampled_post_response_action(workspace_id: str, action: Dict[str, Any]) -> None:
#     settings = CustomSettings()
#     action_type = action["type"]
#     base_filters = {
#         "workspace_id": workspace_id,
#         "codebook_type": CodebookType.INITIAL.value
#     }

#     def get_current_state() -> List[QectResponse]:
#         return qect_repo.find(base_filters)

#     if action_type == "SET_CORRECT":
#         index = action["index"]
#         responses = get_current_state()
#         if 0 <= index < len(responses):
#             response_id = responses[index].id
#             qect_repo.update({"id": response_id}, {"is_correct": True, "comment": ""})

#     elif action_type == "SET_ALL_CORRECT":
#         qect_repo.update(base_filters, {"is_marked": True})

#     elif action_type == "SET_INCORRECT":
#         index = action["index"]
#         responses = get_current_state()
#         if 0 <= index < len(responses):
#             response_id = responses[index].id
#             qect_repo.update({"id": response_id}, {"is_correct": False})

#     elif action_type == "SET_ALL_INCORRECT":
#         qect_repo.update(base_filters, {"is_marked": False})

#     elif action_type == "SET_ALL_UNMARKED":
#         qect_repo.update(base_filters, {"is_marked": None})

#     elif action_type == "UPDATE_COMMENT":
#         index = action["index"]
#         comment = action["comment"]
#         responses = get_current_state()
#         if 0 <= index < len(responses):
#             response_id = responses[index].id
#             qect_repo.update({"id": response_id}, {"comment": comment})

#     elif action_type == "MARK_RESPONSE":
#         index = action["index"]
#         is_marked = action["isMarked"]
#         responses = get_current_state()
#         if 0 <= index < len(responses):
#             response_id = responses[index].id
#             qect_repo.update({"id": response_id}, {"is_marked": is_marked})

#     elif action_type == "MARK_RESPONSE_BY_CODE_EXPLANATION":
#         code = action["code"]
#         quote = action["quote"]
#         post_id = action["postId"]
#         is_marked = action["isMarked"]
#         qect_repo.update(
#             {**base_filters, "code": code, "quote": quote, "post_id": post_id},
#             {"is_marked": is_marked}
#         )

#     elif action_type == "ADD_RESPONSE":
#         response_data = action["response"]
#         if response_data["code"].strip() and response_data["quote"].strip():
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.INITIAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "SET_RESPONSES":
#         qect_repo.delete(base_filters)
#         new_responses = [
#             r for r in (action["responses"] or [])
#             if r["code"].strip() and r["quote"].strip()
#         ]
#         for response_data in new_responses:
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.INITIAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "SET_PARTIAL_RESPONSES":
#         new_responses = [
#             r for r in (action["responses"] or [])
#             if r["code"].strip() and r["quote"].strip()
#         ]
#         qect_repo.delete({**base_filters, "post_id": [r["postId"] for r in new_responses]})
#         for response_data in new_responses:
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.INITIAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "ADD_RESPONSES":
#         new_responses = [
#             r for r in (action["responses"] or [])
#             if r["code"].strip() and r["quote"].strip()
#         ]
#         for response_data in new_responses:
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.INITIAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "REMOVE_RESPONSES":
#         if action.get("all"):
#             qect_repo.delete(base_filters)
#         elif "indexes" in action:
#             responses = get_current_state()
#             indexes = action["indexes"]
#             response_ids_to_delete = [
#                 responses[i].id for i in indexes if 0 <= i < len(responses)
#             ]
#             if response_ids_to_delete:
#                 qect_repo.delete({"id": {"$in": response_ids_to_delete}})

#     elif action_type == "DELETE_CODE":
#         code = action["code"]
#         qect_repo.delete({**base_filters, "code": code})

#     elif action_type == "EDIT_CODE":
#         current_code = action["currentCode"]
#         new_code = action["newCode"]
#         qect_repo.update({**base_filters, "code": current_code}, {"code": new_code})

#     elif action_type == "DELETE_HIGHLIGHT":
#         post_id = action["postId"]
#         sentence = action["sentence"]
#         code = action["code"]
#         qect_repo.delete({**base_filters, "post_id": post_id, "quote": sentence, "code": code})

#     elif action_type == "EDIT_HIGHLIGHT":
#         post_id = action["postId"]
#         sentence = action["sentence"]
#         code = action["code"]
#         new_sentence = action["newSentence"]
#         range_marker = action.get("rangeMarker")
#         updates = {"quote": new_sentence}
#         if range_marker is not None:
#             updates["range_marker"] = json.dumps(range_marker)
#         qect_repo.update(
#             {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
#             updates
#         )

#     elif action_type == "SET_CHAT_HISTORY":
#         post_id = action["postId"]
#         sentence = action["sentence"]
#         code = action["code"]
#         chat_history = json.dumps(action["chatHistory"])
#         qect_repo.update(
#             {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
#             {"chat_history": chat_history}
#         )

#     elif action_type == "UPDATE_CODE":
#         quote = action["quote"]
#         prev_code = action["prevCode"]
#         new_code = action["newCode"]
#         qect_repo.update(
#             {**base_filters, "quote": quote, "code": prev_code},
#             {"code": new_code}
#         )

#     elif action_type == "UPSERT_MARKER":
#         code = action["code"]
#         quote = action["quote"]
#         post_id = action["postId"]
#         range_marker = action["rangeMarker"]
#         qect_repo.update(
#             {**base_filters, "code": code, "quote": quote, "post_id": post_id},
#             {"range_marker": range_marker}
#         )

#     elif action_type == "SYNC_CHAT_STATE":
#         post_id = action["postId"]
#         quote = action["quote"]
#         prev_code = action["prevCode"]
#         current_code = action.get("currentCode")
#         chat_history = action.get("chatHistory")
#         is_marked = action.get("isMarked")
#         refresh = action.get("refresh", False)

#         filters = {**base_filters, "post_id": post_id, "quote": quote, "code": prev_code}
#         responses = qect_repo.find(filters)
#         if responses:
#             response = responses[0]
#             updates = {}

#             if chat_history is not None:
#                 updates["chat_history"] = json.dumps(chat_history)

#             if current_code and current_code.strip():
#                 updates["code"] = current_code

#             if is_marked is not None:
#                 updates["is_marked"] = is_marked

#             if refresh and "chat_history" in updates:
#                 chat_history = json.loads(updates["chat_history"])
#                 chat_history = [
#                     {**msg, "reaction": None, "isThinking": False} if msg["sender"] == "LLM" else msg
#                     for msg in chat_history if not (msg["sender"] == "Human" and msg.get("isEditable"))
#                 ]
#                 updates["chat_history"] = json.dumps(chat_history)

#             if updates:
#                 qect_repo.update({"id": response.id}, updates)

#     elif action_type == "RESET":
#         qect_repo.delete(base_filters)

#     elif action_type == "RESTORE_STATE":
#         for response_data in action["payload"]:
#             response_id = response_data.get("id")
#             if response_id:
#                 existing = qect_repo.find_one({"id": response_id})
#                 if existing:
#                     updates = {
#                         "dataset_id": response_data.get("datasetId", existing.dataset_id),
#                         "model": response_data.get("model", existing.model),
#                         "quote": response_data.get("quote", existing.quote),
#                         "code": response_data.get("code", existing.code),
#                         "explanation": response_data.get("explanation", existing.explanation),
#                         "post_id": response_data.get("postId", existing.post_id),
#                         "response_type": response_data.get("responseType", existing.response_type),
#                         "codebook_type": response_data.get("codebookType", existing.codebook_type),
#                         "chat_history": json.dumps(response_data["chatHistory"]) if "chatHistory" in response_data else existing.chat_history,
#                         "is_marked": response_data.get("isMarked", existing.is_marked),
#                         "range_marker": response_data.get("rangeMarker", existing.range_marker),
#                     }
#                     qect_repo.update({"id": response_id}, updates)
#                 else:
#                     new_response = QectResponse(
#                         id=response_id,
#                         dataset_id=response_data.get("datasetId", workspace_id),
#                         workspace_id=workspace_id,
#                         model=response_data.get("model", settings.ai.model),
#                         quote=response_data.get("quote", ""),
#                         code=response_data.get("code", ""),
#                         explanation=response_data.get("explanation", ""),
#                         post_id=response_data.get("postId", ""),
#                         codebook_type=response_data.get("codebookType", CodebookType.INITIAL.value),
#                         response_type=response_data.get("responseType", ResponseCreatorType.LLM.value),
#                         chat_history=json.dumps(response_data.get("chatHistory", None)),
#                         is_marked=response_data.get("isMarked", None),
#                         created_at=datetime.now()
#                     )
#                     qect_repo.insert(new_response)
#     elif action_type == "RERUN_CODING":
#         pass

#     else:
#         pass

# def process_unseen_post_response_action(workspace_id: str, action: Dict[str, Any]) -> None:
#     action_type = action.get("type")
#     settings = CustomSettings()
#     if not action_type:
#         raise HTTPException(status_code=400, detail="Action type is required")

#     filters = {
#         "workspace_id": workspace_id,
#         "codebook_type": CodebookType.FINAL.value,
#     }
#     if action_type == "SET_CORRECT":
#         response_id = action.get("responseId")
#         qect_repo.update({"id": response_id}, {"is_correct": True, "comment": ""})

#     elif action_type == "SET_ALL_CORRECT":
#         qect_repo.update(filters, {"is_marked": True})

#     elif action_type == "SET_INCORRECT":
#         response_id = action.get("responseId")
#         qect_repo.update({"id": response_id}, {"is_correct": False})

#     elif action_type == "SET_ALL_INCORRECT":
#         qect_repo.update(filters, {"is_marked": False})

#     elif action_type == "SET_ALL_UNMARKED":
#         qect_repo.update(filters, {"is_marked": None})

#     elif action_type == "UPDATE_COMMENT":
#         response_id = action.get("responseId")
#         comment = action.get("comment")
#         qect_repo.update({"id": response_id}, {"comment": comment})

#     elif action_type == "MARK_RESPONSE":
#         response_id = action.get("responseId")
#         is_marked = action.get("isMarked")
#         qect_repo.update({"id": response_id}, {"is_marked": is_marked})

#     elif action_type == "MARK_RESPONSE_BY_CODE_EXPLANATION":
#         code = action.get("code")
#         quote = action.get("quote")
#         post_id = action.get("postId")
#         is_marked = action.get("isMarked")
#         qect_repo.update(
#             {**filters, "code": code, "quote": quote, "post_id": post_id},
#             {"is_marked": is_marked}
#         )

#     elif action_type == "ADD_RESPONSE":
#         response_data = action.get("response")
#         new_response = QectResponse(
#             id=str(uuid4()),
#             workspace_id=workspace_id,
#             dataset_id=response_data.get("datasetId", workspace_id),
#             post_id=response_data["postId"],
#             code=response_data["code"],
#             quote=response_data["quote"],
#             explanation=response_data["explanation"],
#             model=response_data.get("model", settings.ai.model),
#             codebook_type=CodebookType.FINAL.value,
#             response_type=ResponseCreatorType.LLM.value,
#             chat_history=json.dumps(response_data.get("chatHistory")),
#             is_marked=response_data.get("isMarked", True)
#         )
#         qect_repo.insert(new_response)

#     elif action_type == "SET_RESPONSES":
#         qect_repo.delete(filters)
#         for response_data in action.get("responses", []):
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 workspace_id=workspace_id,
#                 dataset_id=response_data.get("datasetId", workspace_id),
#                 post_id=response_data["postId"],
#                 code=response_data["code"],
#                 quote=response_data["quote"],
#                 explanation=response_data["explanation"],
#                 model=response_data.get("model", settings.ai.model),
#                 codebook_type=CodebookType.FINAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", True)
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "SET_PARTIAL_RESPONSES":
#         new_responses = [
#             r for r in (action.get("responses") or [])
#             if r["code"].strip() and r["quote"].strip()
#         ]
#         qect_repo.delete({**filters, "post_id": [r["postId"] for r in new_responses]})
#         for response_data in action.get("responses", []):
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 workspace_id=workspace_id,
#                 dataset_id=response_data.get("datasetId", workspace_id),
#                 post_id=response_data["postId"],
#                 code=response_data["code"],
#                 quote=response_data["quote"],
#                 explanation=response_data["explanation"],
#                 model=response_data.get("model", settings.ai.model),
#                 codebook_type=CodebookType.FINAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", True)
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "ADD_RESPONSES":
#         for response_data in action.get("responses", []):
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 workspace_id=workspace_id,
#                 dataset_id=response_data.get("datasetId", workspace_id),
#                 post_id=response_data["postId"],
#                 code=response_data["code"],
#                 quote=response_data["quote"],
#                 explanation=response_data["explanation"],
#                 model=response_data.get("model", settings.ai.model),
#                 codebook_type=CodebookType.FINAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", True)
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "REMOVE_RESPONSES":
#         if action.get("all"):
#             qect_repo.delete(filters)
#         elif "responseIds" in action:
#             response_ids = action["responseIds"]
#             qect_repo.delete({"id": {"$in": response_ids}})

#     elif action_type == "DELETE_CODE":
#         code = action.get("code")
#         qect_repo.delete({**filters, "code": code})

#     elif action_type == "EDIT_CODE":
#         current_code = action.get("currentCode")
#         new_code = action.get("newCode")
#         qect_repo.update({**filters, "code": current_code}, {"code": new_code})

#     elif action_type == "DELETE_HIGHLIGHT":
#         post_id = action.get("postId")
#         sentence = action.get("sentence")
#         code = action.get("code")
#         qect_repo.delete({**filters, "post_id": post_id, "quote": sentence, "code": code})

#     elif action_type == "EDIT_HIGHLIGHT":
#         post_id = action.get("postId")
#         sentence = action.get("sentence")
#         code = action.get("code")
#         new_sentence = action.get("newSentence")
#         range_marker = action.get("rangeMarker")
#         updates = {"quote": new_sentence}
#         if range_marker is not None:
#             updates["range_marker"] = json.dumps(range_marker)
#         qect_repo.update(
#             {**filters, "post_id": post_id, "quote": sentence, "code": code},
#             updates
#         )

#     elif action_type == "SET_CHAT_HISTORY":
#         post_id = action.get("postId")
#         sentence = action.get("sentence")
#         code = action.get("code")
#         chat_history = action.get("chatHistory")
#         qect_repo.update(
#             {**filters, "post_id": post_id, "quote": sentence, "code": code},
#             {"chat_history": json.dumps(chat_history)}
#         )

#     elif action_type == "UPDATE_CODE":
#         quote = action.get("quote")
#         prev_code = action.get("prevCode")
#         new_code = action.get("newCode")
#         qect_repo.update(
#             {**filters, "quote": quote, "code": prev_code},
#             {"code": new_code}
#         )

#     elif action_type == "UPSERT_MARKER":
#         code = action.get("code")
#         quote = action.get("quote")
#         post_id = action.get("postId")
#         range_marker = action.get("rangeMarker")
#         qect_repo.update(
#             {**filters, "code": code, "quote": quote, "post_id": post_id},
#             {"range_marker": range_marker}
#         )

#     elif action_type == "SYNC_CHAT_STATE":
#         post_id = action.get("postId")
#         quote = action.get("quote")
#         prev_code = action.get("prevCode")
#         current_code = action.get("currentCode")
#         chat_history = action.get("chatHistory")
#         is_marked = action.get("isMarked")
#         refresh = action.get("refresh", False)
#         filters = {**filters, "post_id": post_id, "quote": quote, "code": prev_code}
#         responses = qect_repo.find(filters)
#         if responses:
#             response = responses[0]
#             updates = {}
#             if current_code:
#                 updates["code"] = current_code
#             if chat_history:
#                 updates["chat_history"] = json.dumps(chat_history)
#             if is_marked is not None:
#                 updates["is_marked"] = is_marked
#             if updates:
#                 qect_repo.update({"id": response.id}, updates)

#     elif action_type == "RESET":
#         qect_repo.delete(filters)

#     elif action_type == "RESTORE_STATE":
#         for response_data in action["payload"]:
#             response_id = response_data.get("id")
#             if response_id:
#                 existing = qect_repo.find_one({"id": response_id})
#                 if existing:
#                     updates = {
#                         "dataset_id": response_data.get("datasetId", existing.dataset_id),
#                         "model": response_data.get("model", existing.model),
#                         "quote": response_data.get("quote", existing.quote),
#                         "code": response_data.get("code", existing.code),
#                         "explanation": response_data.get("explanation", existing.explanation),
#                         "post_id": response_data.get("postId", existing.post_id),
#                         "response_type": response_data.get("responseType", existing.response_type),
#                         "codebook_type": response_data.get("codebookType", existing.codebook_type),
#                         "chat_history": json.dumps(response_data["chatHistory"]) if "chatHistory" in response_data else existing.chat_history,
#                         "is_marked": response_data.get("isMarked", existing.is_marked),
#                         "range_marker": response_data.get("rangeMarker", existing.range_marker),
#                     }
#                     qect_repo.update({"id": response_id}, updates)
#                 else:
#                     new_response = QectResponse(
#                         id=response_id,
#                         dataset_id=response_data.get("datasetId", workspace_id),
#                         workspace_id=workspace_id,
#                         model=response_data.get("model", settings.ai.model),
#                         quote=response_data.get("quote", ""),
#                         code=response_data.get("code", ""),
#                         explanation=response_data.get("explanation", ""),
#                         post_id=response_data.get("postId", ""),
#                         codebook_type=response_data.get("codebookType", CodebookType.FINAL.value),
#                         response_type=response_data.get("responseType", ResponseCreatorType.LLM.value),
#                         chat_history=json.dumps(response_data.get("chatHistory", None)),
#                         is_marked=response_data.get("isMarked", None),
#                         created_at=datetime.now()
#                     )
#                     qect_repo.insert(new_response)

#     else:
#         print(f"Unknown action type: {action_type}")
        

def process_initial_codebook_table_action(workspace_id: str, action: Dict[str, Any]) -> None:
    action_type = action.get("type")
    if not action_type:
        raise HTTPException(status_code=400, detail="Action type is required")

    filters = {"coding_context_id": workspace_id}

    if action_type == "INITIALIZE":
        initial_codebook_repo.delete(filters)
        for entry_data in action.get("entries", []):
            entry = InitialCodebookEntry(
                id=str(uuid4()),
                coding_context_id=workspace_id,
                code=entry_data["code"],
                definition=entry_data["definition"]
            )
            initial_codebook_repo.insert(entry)

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
            initial_codebook_repo.insert(entry)

    elif action_type == "UPDATE_FIELD":
        index = action.get("index")
        field = action.get("field")
        value = action.get("value")
        if not all([index is not None, field, value is not None]):
            raise HTTPException(status_code=400, detail="index, field, and value required for UPDATE_FIELD")
        entries = initial_codebook_repo.find(filters)
        if 0 <= index < len(entries):
            entry_id = entries[index].id
            initial_codebook_repo.update({"id": entry_id}, {field: value})
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
        initial_codebook_repo.insert(new_entry)

    elif action_type == "RESET":
        initial_codebook_repo.delete(filters)

    elif action_type == "RESTORE_STATE":
        initial_codebook_repo.delete(filters)
        for entry_data in action.get("payload", []):
            entry = InitialCodebookEntry(
                id=str(uuid4()),
                coding_context_id=workspace_id,
                code=entry_data["code"],
                definition=entry_data["definition"]
            )
            initial_codebook_repo.insert(entry)

    else:
        print(f"Unknown action type: {action_type}")

def process_grouped_codes_action(workspace_id: str, action: Dict[str, Any]) -> None:
    action_type = action.get("type")
    if not action_type:
        raise ValueError("Action type is required")

    filters = {"coding_context_id": workspace_id}

    if action_type == "ADD_BUCKET":
        bucket_id = str(uuid4())
        grouped_code_repo.insert(
            GroupedCodeEntry(
                coding_context_id=workspace_id,
                higher_level_code="New Bucket",
                higher_level_code_id=bucket_id,
                code=None,
            )
        )

    elif action_type == "DELETE_BUCKET":
        bucket_id = action.get("payload")
        if not bucket_id:
            raise ValueError("Bucket ID is required for DELETE_BUCKET")
        grouped_code_repo.update(
            {"coding_context_id": workspace_id, "higher_level_code_id": bucket_id},
            {"higher_level_code": None, "higher_level_code_id": None}
        )

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
        grouped_code_repo.update(
            {"coding_context_id": workspace_id, "code": code},
            {
                "higher_level_code_id": target_bucket_id,
                "higher_level_code": target_bucket.higher_level_code
            }
        )

    elif action_type == "MOVE_UNPLACED_TO_MISC":
        print(f"Payload for MOVE_UNPLACED_TO_MISC")
        misc_bucket_id = "miscellaneous" 
        misc_bucket_name = "Miscellaneous"
        grouped_code_repo.execute_raw_query("""UPDATE grouped_code_entries
            SET higher_level_code = ?, higher_level_code_id = ?
            WHERE coding_context_id = ? AND higher_level_code_id IS NULL AND higher_level_code IS NULL""",
            (misc_bucket_name, misc_bucket_id, workspace_id)
        )

    elif action_type == "UPDATE_BUCKET_NAME":
        payload = action.get("payload")
        if not payload or "bucketId" not in payload or "newName" not in payload:
            raise ValueError("bucketId and newName are required for UPDATE_BUCKET_NAME")
        bucket_id = payload["bucketId"]
        new_name = payload["newName"]
        grouped_code_repo.update(
            {"coding_context_id": workspace_id, "higher_level_code_id": bucket_id},
            {"higher_level_code": new_name}
        )

    elif action_type == "RESTORE_STATE":
        payload = action.get("payload")
        if not payload:
            raise ValueError("Payload is required for RESTORE_STATE")
        grouped_code_repo.update(
            {"coding_context_id": workspace_id},
            {"higher_level_code": None, "higher_level_code_id": None}
        )
        
        for bucket_data in payload:
            if bucket_data.get("id") is not None:  
                bucket_id = bucket_data["id"]
                bucket_name = bucket_data["name"]
                codes = bucket_data.get("codes", [])
                for code in codes:
                    grouped_code_repo.update(
                        {"coding_context_id": workspace_id, "code": code},
                        {"higher_level_code": bucket_name, "higher_level_code_id": bucket_id}
                    )

    else:
        raise ValueError(f"Unknown action type: {action_type}")
    

def process_themes_action(workspace_id: str, action: Dict[str, Any]) -> None:
    action_type = action.get("type")
    if not action_type:
        raise ValueError("Action type is required")

    if action_type == "ADD_THEME":
        theme_id = str(uuid4())
        themes_repo.insert(
            ThemeEntry(
                coding_context_id=workspace_id,
                theme="New Theme",
                theme_id=theme_id,
                higher_level_code=None,
            )
        )

    elif action_type == "DELETE_THEME":
        theme_id = action.get("payload")
        if not theme_id:
            raise ValueError("Theme ID is required for DELETE_THEME")
        themes_repo.update(
            {"coding_context_id": workspace_id, "theme_id": theme_id},
            {"theme": None, "theme_id": None}
        )

    elif action_type == "MOVE_CODE_TO_THEME":
        payload = action.get("payload")
        if not payload or "code" not in payload or "targetThemeId" not in payload:
            raise ValueError("code, targetThemeId, and targetThemeName are required for MOVE_CODE_TO_THEME")
        code = payload["code"]
        target_theme_id = payload["targetThemeId"]
        target_bucket = themes_repo.find_one({"theme_id": target_theme_id}, fail_silently=True)
        if not target_bucket:
            raise ValueError(f"Target theme with ID {target_theme_id} does not exist")
        themes_repo.update(
            {"coding_context_id": workspace_id, "higher_level_code": code},
            {"theme": target_bucket.theme, "theme_id": target_theme_id}
        )

    elif action_type == "MOVE_UNPLACED_TO_MISC":
        misc_theme_id = "miscellaneous"
        misc_theme_name = "Miscellaneous"
        themes_repo.update(
            {"coding_context_id": workspace_id, "theme_id": None},
            {"theme": misc_theme_name, "theme_id": misc_theme_id}
        )

    elif action_type == "UPDATE_THEME_NAME":
        payload = action.get("payload")
        if not payload or "themeId" not in payload or "newName" not in payload:
            raise ValueError("themeId and newName are required for UPDATE_THEME_NAME")
        theme_id = payload["themeId"]
        new_name = payload["newName"]
        themes_repo.update(
            {"coding_context_id": workspace_id, "theme_id": theme_id},
            {"theme": new_name}
        )

    elif action_type == "RESTORE_STATE":
        payload = action.get("payload")
        if not payload:
            raise ValueError("Payload is required for RESTORE_STATE")
        themes_repo.update(
            {"coding_context_id": workspace_id},
            {"theme": None, "theme_id": None}
        )
        for theme_data in payload:
            if theme_data.get("id") is not None:  
                theme_id = theme_data["id"]
                theme_name = theme_data["name"]
                codes = theme_data.get("codes", [])
                for code in codes:
                    themes_repo.update(
                        {"coding_context_id": workspace_id, "higher_level_code": code},
                        {"theme": theme_name, "theme_id": theme_id}
                    )

    else:
        raise ValueError(f"Unknown action type: {action_type}")
    
# def process_manual_coding_responses_action(workspace_id: str, action: Dict[str, Any]) -> None:
#     settings = CustomSettings()
#     action_type = action["type"]
#     base_filters = {
#         "workspace_id": workspace_id,
#         "codebook_type": CodebookType.MANUAL.value
#     }

#     def get_current_state() -> List[QectResponse]:
#         return qect_repo.find(base_filters)

#     if action_type == "SET_CORRECT":
#         index = action["index"]
#         qect_repo.update({"id": index}, {"is_marked": True})

#     elif action_type == "SET_ALL_CORRECT":
#         qect_repo.update(base_filters, {"is_marked": True})

#     elif action_type == "SET_INCORRECT":
#         index = action["index"]
#         qect_repo.update({"id": index}, {"is_marked": False})

#     elif action_type == "SET_ALL_INCORRECT":
#         qect_repo.update(base_filters, {"is_marked": False})

#     elif action_type == "SET_ALL_UNMARKED":
#         qect_repo.update(base_filters, {"is_marked": None})

#     elif action_type == "UPDATE_COMMENT":
#         index = action["index"]
#         comment = action["comment"]
#         qect_repo.update({"id": index}, {"comment": comment})

#     elif action_type == "MARK_RESPONSE":
#         index = action["index"]
#         is_marked = action["isMarked"]
#         qect_repo.update({"id": index}, {"is_marked": is_marked})

#     elif action_type == "MARK_RESPONSE_BY_CODE_EXPLANATION":
#         code = action["code"]
#         quote = action["quote"]
#         post_id = action["postId"]
#         is_marked = action["isMarked"]
#         qect_repo.update(
#             {**base_filters, "code": code, "quote": quote, "post_id": post_id},
#             {"is_marked": is_marked}
#         )

#     elif action_type == "ADD_RESPONSE":
#         response_data = action["response"]
#         if response_data["code"].strip() and response_data["quote"].strip():
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.MANUAL.value,
#                 response_type=ResponseCreatorType.HUMAN.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "SET_RESPONSES":
#         qect_repo.delete(base_filters)
#         new_responses = [
#             r for r in (action["responses"] or [])
#             if r["code"].strip() and r["quote"].strip()
#         ]
#         for response_data in new_responses:
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.MANUAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "SET_PARTIAL_RESPONSES":
#         new_responses = [
#             r for r in (action["responses"] or [])
#             if r["code"].strip() and r["quote"].strip()
#         ]
#         qect_repo.delete({**base_filters, "post_id": [r["postId"] for r in new_responses]})
#         for response_data in new_responses:
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.MANUAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "ADD_RESPONSES":
#         new_responses = [
#             r for r in (action["responses"] or [])
#             if r["code"].strip() and r["quote"].strip()
#         ]
#         for response_data in new_responses:
#             new_response = QectResponse(
#                 id=str(uuid4()),
#                 dataset_id=workspace_id,
#                 workspace_id=workspace_id,
#                 model=response_data.get("model", settings.ai.model),
#                 quote=response_data["quote"],
#                 code=response_data["code"],
#                 explanation=response_data["explanation"],
#                 post_id=response_data["postId"],
#                 codebook_type=CodebookType.MANUAL.value,
#                 response_type=ResponseCreatorType.LLM.value,
#                 chat_history=json.dumps(response_data.get("chatHistory")),
#                 is_marked=response_data.get("isMarked", None),
#                 created_at=datetime.now()
#             )
#             qect_repo.insert(new_response)

#     elif action_type == "REMOVE_RESPONSES":
#         if action.get("all"):
#             qect_repo.delete(base_filters)
#         elif "indexes" in action:
#             responses = get_current_state()
#             indexes = action["indexes"]
#             response_ids_to_delete = [
#                 responses[i].id for i in indexes if 0 <= i < len(responses)
#             ]
#             if response_ids_to_delete:
#                 qect_repo.delete({"id": {"$in": response_ids_to_delete}})

#     elif action_type == "DELETE_CODE":
#         code = action["code"]
#         qect_repo.delete({**base_filters, "code": code})

#     elif action_type == "EDIT_CODE":
#         current_code = action["currentCode"]
#         new_code = action["newCode"]
#         qect_repo.update({**base_filters, "code": current_code}, {"code": new_code})

#     elif action_type == "DELETE_HIGHLIGHT":
#         post_id = action["postId"]
#         sentence = action["sentence"]
#         code = action["code"]
#         qect_repo.delete({**base_filters, "post_id": post_id, "quote": sentence, "code": code})

#     elif action_type == "EDIT_HIGHLIGHT":
#         post_id = action["postId"]
#         sentence = action["sentence"]
#         code = action["code"]
#         new_sentence = action["newSentence"]
#         range_marker = action.get("rangeMarker")
#         updates = {"quote": new_sentence}
#         if range_marker is not None:
#             updates["range_marker"] = json.dumps(range_marker)
#         qect_repo.update(
#             {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
#             updates
#         )

#     elif action_type == "SET_CHAT_HISTORY":
#         post_id = action["postId"]
#         sentence = action["sentence"]
#         code = action["code"]
#         chat_history = json.dumps(action["chatHistory"])
#         qect_repo.update(
#             {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
#             {"chat_history": chat_history}
#         )

#     elif action_type == "UPDATE_CODE":
#         quote = action["quote"]
#         prev_code = action["prevCode"]
#         new_code = action["newCode"]
#         qect_repo.update(
#             {**base_filters, "quote": quote, "code": prev_code},
#             {"code": new_code}
#         )

#     elif action_type == "UPSERT_MARKER":
#         code = action["code"]
#         quote = action["quote"]
#         post_id = action["postId"]
#         range_marker = action["rangeMarker"]
#         qect_repo.update(
#             {**base_filters, "code": code, "quote": quote, "post_id": post_id},
#             {"range_marker": range_marker}
#         )

#     elif action_type == "SYNC_CHAT_STATE":
#         post_id = action["postId"]
#         quote = action["quote"]
#         prev_code = action["prevCode"]
#         current_code = action.get("currentCode")
#         chat_history = action.get("chatHistory")
#         is_marked = action.get("isMarked")
#         refresh = action.get("refresh", False)

#         filters = {**base_filters, "post_id": post_id, "quote": quote, "code": prev_code}
#         responses = qect_repo.find(filters)
#         if responses:
#             response = responses[0]
#             updates = {}

#             if chat_history is not None:
#                 updates["chat_history"] = json.dumps(chat_history)

#             if current_code and current_code.strip():
#                 updates["code"] = current_code

#             if is_marked is not None:
#                 updates["is_marked"] = is_marked

#             if refresh and "chat_history" in updates:
#                 chat_history = json.loads(updates["chat_history"])
#                 chat_history = [
#                     {**msg, "reaction": None, "isThinking": False} if msg["sender"] == "LLM" else msg
#                     for msg in chat_history if not (msg["sender"] == "Human" and msg.get("isEditable"))
#                 ]
#                 updates["chat_history"] = json.dumps(chat_history)

#             if updates:
#                 qect_repo.update({"id": response.id}, updates)

#     elif action_type == "RESET":
#         qect_repo.delete(base_filters)

#     if action_type == "RESTORE_STATE":
#         for response_data in action["payload"]:
#             response_id = response_data.get("id")
#             if response_id:
#                 existing = qect_repo.find_one({"id": response_id})
#                 if existing:
#                     updates = {
#                         "dataset_id": response_data.get("datasetId", existing.dataset_id),
#                         "model": response_data.get("model", existing.model),
#                         "quote": response_data.get("quote", existing.quote),
#                         "code": response_data.get("code", existing.code),
#                         "explanation": response_data.get("explanation", existing.explanation),
#                         "post_id": response_data.get("postId", existing.post_id),
#                         "response_type": response_data.get("responseType", existing.response_type),
#                         "codebook_type": response_data.get("codebookType", existing.codebook_type),
#                         "chat_history": json.dumps(response_data["chatHistory"]) if "chatHistory" in response_data else existing.chat_history,
#                         "is_marked": response_data.get("isMarked", existing.is_marked),
#                         "range_marker": response_data.get("rangeMarker", existing.range_marker),
#                     }
#                     qect_repo.update({"id": response_id}, updates)
#                 else:
#                     new_response = QectResponse(
#                         id=response_id,
#                         dataset_id=response_data.get("datasetId", workspace_id),
#                         workspace_id=workspace_id,
#                         model=response_data.get("model", settings.ai.model),
#                         quote=response_data.get("quote", ""),
#                         code=response_data.get("code", ""),
#                         explanation=response_data.get("explanation", ""),
#                         post_id=response_data.get("postId", ""),
#                         codebook_type=response_data.get("codebookType", CodebookType.MANUAL.value),
#                         response_type=response_data.get("responseType", ResponseCreatorType.LLM.value),
#                         chat_history=json.dumps(response_data.get("chatHistory", None)),
#                         is_marked=response_data.get("isMarked", None),
#                         created_at=datetime.now()
#                     )
#                     qect_repo.insert(new_response)

#     elif action_type == "RERUN_CODING":
#         pass

#     else:
#         pass

def process_action(
    workspace_id: str,
    action: Dict[str, Any],
    codebook_type: str,
    default_response_type: str,
    use_index: bool = True,
    strict_action_type: bool = False
) -> None:
    settings = CustomSettings()
    action_type = action.get("type")
    
    if strict_action_type and not action_type:
        raise HTTPException(status_code=400, detail="Action type is required")

    base_filters = {
        "workspace_id": workspace_id,
        "codebook_type": codebook_type
    }

    print(f"Processing action: {action_type} for workspace: {workspace_id}", action)

    def update_response(identifier: Any, updates: Dict[str, Any]) -> None:
        qect_repo.update(identifier, updates)

    if action_type == "SET_CORRECT":
        updates = {"is_correct": True, "comment": "", "is_marked": True}
        update_response({"id": action["index"]}, updates)

    elif action_type == "SET_ALL_CORRECT":
        result = qect_repo.execute_raw_query("SELECT is_marked FROM qect WHERE workspace_id = ? AND codebook_type = ? GROUP BY is_marked;", (workspace_id, codebook_type), keys=True)
        true_count = sum(1 for row in result if row['is_marked'])
        if true_count < len(result):
            print(f"Setting all responses to correct for workspace: {workspace_id}")
            qect_repo.update(base_filters, {"is_marked": True})
        else:
            print(f"Setting all responses to unmarked for workspace: {workspace_id}")
            qect_repo.update(base_filters, {"is_marked": None})

    elif action_type == "SET_INCORRECT":
        updates = { "is_marked": False}
        update_response({"id": action["index"]}, updates)

    elif action_type == "SET_ALL_INCORRECT":
        result = qect_repo.execute_raw_query("SELECT is_marked FROM qect WHERE workspace_id = ? AND codebook_type = ? GROUP BY is_marked;", (workspace_id, codebook_type), keys=True)
        false_count = sum(1 for row in result if row['is_marked'] == 0)
        if false_count < len(result):
            print(f"Setting all responses to incorrect for workspace: {workspace_id}")
            qect_repo.update(base_filters, {"is_marked": False})
        else:
            print(f"Setting all responses to unmarked for workspace: {workspace_id}")
            qect_repo.update(base_filters, {"is_marked": None})

    elif action_type == "SET_ALL_UNMARKED":
        print(f"Setting all responses to unmarked for workspace: {workspace_id}")
        qect_repo.update(base_filters, {"is_marked": None})

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
        qect_repo.update(
            {**base_filters, "code": code, "quote": quote, "post_id": post_id},
            {"is_marked": is_marked}
        )

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
            qect_repo.insert(new_response)

    elif action_type == "SET_RESPONSES":
        qect_repo.delete(base_filters)
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
            qect_repo.insert(new_response)

    elif action_type == "SET_PARTIAL_RESPONSES":
        new_responses = [
            r for r in (action.get("responses") or [])
            if r["code"].strip() and r["quote"].strip()
        ]
        qect_repo.delete({**base_filters, "post_id": [r["postId"] for r in new_responses]})
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
            qect_repo.insert(new_response)

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
            qect_repo.insert(new_response)

    elif action_type == "REMOVE_RESPONSES":
        if action.get("all"):
            qect_repo.delete(base_filters)
        elif "indexes" in action and use_index:
            indexes = action["indexes"]
            if len(indexes):
                qect_repo.delete({"id": indexes})
        elif "responseIds" in action and not use_index:
            response_ids = action["responseIds"]
            qect_repo.delete({"id": response_ids})

    elif action_type == "DELETE_CODE":
        code = action.get("code")
        qect_repo.delete({**base_filters, "code": code})

    elif action_type == "EDIT_CODE":
        current_code = action.get("currentCode")
        new_code = action.get("newCode")
        qect_repo.update({**base_filters, "code": current_code}, {"code": new_code})

    elif action_type == "DELETE_HIGHLIGHT":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        qect_repo.delete({**base_filters, "post_id": post_id, "quote": sentence, "code": code})

    elif action_type == "EDIT_HIGHLIGHT":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        new_sentence = action.get("newSentence")
        range_marker = action.get("rangeMarker")
        updates = {"quote": new_sentence}
        if range_marker is not None:
            updates["range_marker"] = json.dumps(range_marker)
        qect_repo.update(
            {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
            updates
        )

    elif action_type == "SET_CHAT_HISTORY":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        chat_history = json.dumps(action.get("chatHistory"))
        qect_repo.update(
            {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
            {"chat_history": chat_history}
        )

    elif action_type == "UPDATE_CODE":
        quote = action.get("quote")
        prev_code = action.get("prevCode")
        new_code = action.get("newCode")
        qect_repo.update(
            {**base_filters, "quote": quote, "code": prev_code},
            {"code": new_code}
        )

    elif action_type == "UPSERT_MARKER":
        code = action.get("code")
        quote = action.get("quote")
        post_id = action.get("postId")
        range_marker = action.get("rangeMarker")
        qect_repo.update(
            {**base_filters, "code": code, "quote": quote, "post_id": post_id},
            {"range_marker": range_marker}
        )

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
                qect_repo.update({"id": response.id}, updates)

    elif action_type == "RESET":
        qect_repo.delete(base_filters)

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
                    qect_repo.update({"id": response_id}, updates)
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
                    qect_repo.insert(new_response)

    elif action_type == "RERUN_CODING":
        pass

    else:
        print(f"Unknown action type: {action_type}")

def process_sampled_post_response_action(workspace_id: str, action: Dict[str, Any]) -> None:
    process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.INITIAL.value,
        default_response_type=ResponseCreatorType.LLM.value,
        use_index=True,
        strict_action_type=False
    )

def process_unseen_post_response_action(workspace_id: str, action: Dict[str, Any]) -> None:
    process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.FINAL.value,
        default_response_type=ResponseCreatorType.LLM.value,
        use_index=False,
        strict_action_type=True
    )

def process_manual_coding_responses_action(workspace_id: str, action: Dict[str, Any]) -> None:
    process_action(
        workspace_id=workspace_id,
        action=action,
        codebook_type=CodebookType.MANUAL.value,
        default_response_type=ResponseCreatorType.HUMAN.value,
        use_index=True,
        strict_action_type=False
    )