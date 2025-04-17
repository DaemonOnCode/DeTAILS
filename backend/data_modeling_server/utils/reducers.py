from datetime import datetime
from http.client import HTTPException
import json
from typing import Any, Dict, List
from uuid import uuid4
from config import CustomSettings
from database.initial_codebook_table import InitialCodebookEntriesRepository
from database.keyword_entry_table import KeywordEntriesRepository
from database.qect_table import QectRepository
from models.table_dataclasses import CodebookType, InitialCodebookEntry, KeywordEntry, QectResponse, ResponseCreatorType


keyword_entries_repo = KeywordEntriesRepository()
qect_repo = QectRepository()
initial_codebook_repo = InitialCodebookEntriesRepository()

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
    

def process_sampled_post_response_action(workspace_id: str, action: Dict[str, Any]) -> None:
    settings = CustomSettings()
    action_type = action["type"]
    base_filters = {
        "workspace_id": workspace_id,
        "codebook_type": CodebookType.INITIAL.value
    }

    def get_current_state() -> List[QectResponse]:
        return qect_repo.find(base_filters)

    if action_type == "SET_CORRECT":
        index = action["index"]
        responses = get_current_state()
        if 0 <= index < len(responses):
            response_id = responses[index].id
            qect_repo.update({"id": response_id}, {"is_correct": True, "comment": ""})

    elif action_type == "SET_ALL_CORRECT":
        qect_repo.update(base_filters, {"is_marked": True})

    elif action_type == "SET_INCORRECT":
        index = action["index"]
        responses = get_current_state()
        if 0 <= index < len(responses):
            response_id = responses[index].id
            qect_repo.update({"id": response_id}, {"is_correct": False})

    elif action_type == "SET_ALL_INCORRECT":
        qect_repo.update(base_filters, {"is_marked": False})

    elif action_type == "SET_ALL_UNMARKED":
        qect_repo.update(base_filters, {"is_marked": None})

    elif action_type == "UPDATE_COMMENT":
        index = action["index"]
        comment = action["comment"]
        responses = get_current_state()
        if 0 <= index < len(responses):
            response_id = responses[index].id
            qect_repo.update({"id": response_id}, {"comment": comment})

    elif action_type == "MARK_RESPONSE":
        index = action["index"]
        is_marked = action["isMarked"]
        responses = get_current_state()
        if 0 <= index < len(responses):
            response_id = responses[index].id
            qect_repo.update({"id": response_id}, {"is_marked": is_marked})

    elif action_type == "MARK_RESPONSE_BY_CODE_EXPLANATION":
        code = action["code"]
        quote = action["quote"]
        post_id = action["postId"]
        is_marked = action["isMarked"]
        qect_repo.update(
            {**base_filters, "code": code, "quote": quote, "post_id": post_id},
            {"is_marked": is_marked}
        )

    elif action_type == "ADD_RESPONSE":
        response_data = action["response"]
        if response_data["code"].strip() and response_data["quote"].strip():
            new_response = QectResponse(
                id=str(uuid4()),
                dataset_id=response_data["datasetId"],
                workspace_id=workspace_id,
                model=response_data.get("model", settings.ai.model),
                quote=response_data["quote"],
                code=response_data["code"],
                explanation=response_data["explanation"],
                post_id=response_data["postId"],
                codebook_type=CodebookType.INITIAL.value,
                response_type=ResponseCreatorType.LLM.value,
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", None),
                created_at=datetime.now()
            )
            qect_repo.insert(new_response)

    elif action_type == "SET_RESPONSES":
        qect_repo.delete(base_filters)
        new_responses = [
            r for r in (action["responses"] or [])
            if r["code"].strip() and r["quote"].strip()
        ]
        for response_data in new_responses:
            new_response = QectResponse(
                id=str(uuid4()),
                dataset_id=workspace_id,
                workspace_id=workspace_id,
                model=response_data.get("model", settings.ai.model),
                quote=response_data["quote"],
                code=response_data["code"],
                explanation=response_data["explanation"],
                post_id=response_data["postId"],
                codebook_type=CodebookType.INITIAL.value,
                response_type=ResponseCreatorType.LLM.value,
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", None),
                created_at=datetime.now()
            )
            qect_repo.insert(new_response)

    elif action_type == "ADD_RESPONSES":
        new_responses = [
            r for r in (action["responses"] or [])
            if r["code"].strip() and r["quote"].strip()
        ]
        for response_data in new_responses:
            new_response = QectResponse(
                id=str(uuid4()),
                dataset_id=workspace_id,
                workspace_id=workspace_id,
                model=response_data.get("model", settings.ai.model),
                quote=response_data["quote"],
                code=response_data["code"],
                explanation=response_data["explanation"],
                post_id=response_data["postId"],
                codebook_type=CodebookType.INITIAL.value,
                response_type=ResponseCreatorType.LLM.value,
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", None),
                created_at=datetime.now()
            )
            qect_repo.insert(new_response)

    elif action_type == "REMOVE_RESPONSES":
        if action.get("all"):
            qect_repo.delete(base_filters)
        elif "indexes" in action:
            responses = get_current_state()
            indexes = action["indexes"]
            response_ids_to_delete = [
                responses[i].id for i in indexes if 0 <= i < len(responses)
            ]
            if response_ids_to_delete:
                qect_repo.delete({"id": {"$in": response_ids_to_delete}})

    elif action_type == "DELETE_CODE":
        code = action["code"]
        qect_repo.delete({**base_filters, "code": code})

    elif action_type == "EDIT_CODE":
        current_code = action["currentCode"]
        new_code = action["newCode"]
        qect_repo.update({**base_filters, "code": current_code}, {"code": new_code})

    elif action_type == "DELETE_HIGHLIGHT":
        post_id = action["postId"]
        sentence = action["sentence"]
        code = action["code"]
        qect_repo.delete({**base_filters, "post_id": post_id, "quote": sentence, "code": code})

    elif action_type == "EDIT_HIGHLIGHT":
        post_id = action["postId"]
        sentence = action["sentence"]
        code = action["code"]
        new_sentence = action["newSentence"]
        range_marker = action.get("rangeMarker")
        updates = {"quote": new_sentence}
        if range_marker is not None:
            updates["range_marker"] = json.dumps(range_marker)
        qect_repo.update(
            {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
            updates
        )

    elif action_type == "SET_CHAT_HISTORY":
        post_id = action["postId"]
        sentence = action["sentence"]
        code = action["code"]
        chat_history = json.dumps(action["chatHistory"])
        qect_repo.update(
            {**base_filters, "post_id": post_id, "quote": sentence, "code": code},
            {"chat_history": chat_history}
        )

    elif action_type == "UPDATE_CODE":
        quote = action["quote"]
        prev_code = action["prevCode"]
        new_code = action["newCode"]
        qect_repo.update(
            {**base_filters, "quote": quote, "code": prev_code},
            {"code": new_code}
        )

    elif action_type == "UPSERT_MARKER":
        code = action["code"]
        quote = action["quote"]
        post_id = action["postId"]
        range_marker = action["rangeMarker"]
        qect_repo.update(
            {**base_filters, "code": code, "quote": quote, "post_id": post_id},
            {"range_marker": range_marker}
        )

    elif action_type == "SYNC_CHAT_STATE":
        post_id = action["postId"]
        quote = action["quote"]
        prev_code = action["prevCode"]
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
        qect_repo.delete(base_filters)
        for response_data in action["payload"]:
            if response_data["code"].strip() and response_data["quote"].strip():
                new_response = QectResponse(
                    id=str(uuid4()),
                    dataset_id=workspace_id,
                    workspace_id=workspace_id,
                    model=response_data.get("model", settings.ai.model),
                    quote=response_data["quote"],
                    code=response_data["code"],
                    explanation=response_data["explanation"],
                    post_id=response_data["postId"],
                    codebook_type=CodebookType.INITIAL.value,
                    response_type=ResponseCreatorType.LLM.value,
                    chat_history=json.dumps(response_data.get("chatHistory")),
                    is_marked=response_data.get("isMarked", None),
                    created_at=datetime.now()
                )
                qect_repo.insert(new_response)

    elif action_type == "RERUN_CODING":
        pass

    else:
        pass

def process_unseen_post_response_action(workspace_id: str, action: Dict[str, Any]) -> None:
    action_type = action.get("type")
    settings = CustomSettings()
    if not action_type:
        raise HTTPException(status_code=400, detail="Action type is required")

    filters = {
        "workspace_id": workspace_id,
        "codebook_type": CodebookType.FINAL,
    }
    if action_type == "SET_CORRECT":
        response_id = action.get("responseId")
        qect_repo.update({"id": response_id}, {"is_correct": True, "comment": ""})

    elif action_type == "SET_ALL_CORRECT":
        qect_repo.update(filters, {"is_marked": True})

    elif action_type == "SET_INCORRECT":
        response_id = action.get("responseId")
        qect_repo.update({"id": response_id}, {"is_correct": False})

    elif action_type == "SET_ALL_INCORRECT":
        qect_repo.update(filters, {"is_marked": False})

    elif action_type == "SET_ALL_UNMARKED":
        qect_repo.update(filters, {"is_marked": None})

    elif action_type == "UPDATE_COMMENT":
        response_id = action.get("responseId")
        comment = action.get("comment")
        qect_repo.update({"id": response_id}, {"comment": comment})

    elif action_type == "MARK_RESPONSE":
        response_id = action.get("responseId")
        is_marked = action.get("isMarked")
        qect_repo.update({"id": response_id}, {"is_marked": is_marked})

    elif action_type == "MARK_RESPONSE_BY_CODE_EXPLANATION":
        code = action.get("code")
        quote = action.get("quote")
        post_id = action.get("postId")
        is_marked = action.get("isMarked")
        qect_repo.update(
            {**filters, "code": code, "quote": quote, "post_id": post_id},
            {"is_marked": is_marked}
        )

    elif action_type == "ADD_RESPONSE":
        response_data = action.get("response")
        new_response = QectResponse(
            id=str(uuid4()),
            workspace_id=workspace_id,
            dataset_id=response_data.get("datasetId", workspace_id),
            post_id=response_data["postId"],
            code=response_data["code"],
            quote=response_data["quote"],
            explanation=response_data["explanation"],
            model=response_data.get("model", settings.ai.model),
            codebook_type=CodebookType.FINAL,
            response_type=ResponseCreatorType.LLM,
            chat_history=json.dumps(response_data.get("chatHistory")),
            is_marked=response_data.get("isMarked", True)
        )
        qect_repo.insert(new_response)

    elif action_type == "SET_RESPONSES":
        qect_repo.delete(filters)
        for response_data in action.get("responses", []):
            new_response = QectResponse(
                id=str(uuid4()),
                workspace_id=workspace_id,
                dataset_id=response_data.get("datasetId", workspace_id),
                post_id=response_data["postId"],
                code=response_data["code"],
                quote=response_data["quote"],
                explanation=response_data["explanation"],
                model=response_data.get("model", settings.ai.model),
                codebook_type=CodebookType.FINAL,
                response_type=ResponseCreatorType.LLM,
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", True)
            )
            qect_repo.insert(new_response)

    elif action_type == "ADD_RESPONSES":
        for response_data in action.get("responses", []):
            new_response = QectResponse(
                id=str(uuid4()),
                workspace_id=workspace_id,
                dataset_id=response_data.get("datasetId", workspace_id),
                post_id=response_data["postId"],
                code=response_data["code"],
                quote=response_data["quote"],
                explanation=response_data["explanation"],
                model=response_data.get("model", settings.ai.model),
                codebook_type=CodebookType.FINAL,
                response_type=ResponseCreatorType.LLM,
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", True)
            )
            qect_repo.insert(new_response)

    elif action_type == "REMOVE_RESPONSES":
        if action.get("all"):
            qect_repo.delete(filters)
        elif "responseIds" in action:
            response_ids = action["responseIds"]
            qect_repo.delete({"id": {"$in": response_ids}})

    elif action_type == "DELETE_CODE":
        code = action.get("code")
        qect_repo.delete({**filters, "code": code})

    elif action_type == "EDIT_CODE":
        current_code = action.get("currentCode")
        new_code = action.get("newCode")
        qect_repo.update({**filters, "code": current_code}, {"code": new_code})

    elif action_type == "DELETE_HIGHLIGHT":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        qect_repo.delete({**filters, "post_id": post_id, "quote": sentence, "code": code})

    elif action_type == "EDIT_HIGHLIGHT":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        new_sentence = action.get("newSentence")
        range_marker = action.get("rangeMarker")
        updates = {"quote": new_sentence}
        if range_marker is not None:
            updates["range_marker"] = range_marker
        qect_repo.update(
            {**filters, "post_id": post_id, "quote": sentence, "code": code},
            updates
        )

    elif action_type == "SET_CHAT_HISTORY":
        post_id = action.get("postId")
        sentence = action.get("sentence")
        code = action.get("code")
        chat_history = action.get("chatHistory")
        qect_repo.update(
            {**filters, "post_id": post_id, "quote": sentence, "code": code},
            {"chat_history": json.dumps(chat_history)}
        )

    elif action_type == "UPDATE_CODE":
        quote = action.get("quote")
        prev_code = action.get("prevCode")
        new_code = action.get("newCode")
        qect_repo.update(
            {**filters, "quote": quote, "code": prev_code},
            {"code": new_code}
        )

    elif action_type == "UPSERT_MARKER":
        code = action.get("code")
        quote = action.get("quote")
        post_id = action.get("postId")
        range_marker = action.get("rangeMarker")
        qect_repo.update(
            {**filters, "code": code, "quote": quote, "post_id": post_id},
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
        filters = {**filters, "post_id": post_id, "quote": quote, "code": prev_code}
        responses = qect_repo.find(filters)
        if responses:
            response = responses[0]
            updates = {}
            if current_code:
                updates["code"] = current_code
            if chat_history:
                updates["chat_history"] = json.dumps(chat_history)
            if is_marked is not None:
                updates["is_marked"] = is_marked
            if updates:
                qect_repo.update({"id": response.id}, updates)

    elif action_type == "RESET":
        qect_repo.delete(filters)

    elif action_type == "RESTORE_STATE":
        qect_repo.delete(filters)
        for response_data in action.get("payload", []):
            new_response = QectResponse(
                id=str(uuid4()),
                workspace_id=workspace_id,
                dataset_id=response_data.get("datasetId", workspace_id),
                post_id=response_data["postId"],
                code=response_data["code"],
                quote=response_data["quote"],
                explanation=response_data["explanation"],
                model=response_data.get("model", settings.ai.model),
                codebook_type=CodebookType.FINAL,
                response_type=ResponseCreatorType.LLM,
                chat_history=json.dumps(response_data.get("chatHistory")),
                is_marked=response_data.get("isMarked", True)
            )
            qect_repo.insert(new_response)

    else:
        print(f"Unknown action type: {action_type}")
        

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