
import json
from models.state_models import CodingContext, CollectionContext, ModelingContext
from routes.modeling_routes import execute_query


def save_state(data):
    collection_context = CollectionContext(**data.collection_context)
    coding_context = CodingContext(**data.coding_context)
    modeling_context = ModelingContext(**data.modeling_context)

    models = json.dumps(modeling_context.models)

    selected_posts = json.dumps(collection_context.selected_posts)
    basis_files = json.dumps(coding_context.basis_files)
    themes = json.dumps(coding_context.themes)
    selected_themes = json.dumps(coding_context.selected_themes)
    references_data = json.dumps(coding_context.references)
    codebook = json.dumps(coding_context.codebook)
    code_responses = json.dumps(coding_context.code_responses)
    final_code_responses = json.dumps(coding_context.final_code_responses)

    # Insert or update the user context based on workspace_id, user_email, and dataset_id
    execute_query(
        """
        INSERT INTO workspace_states (
            workspace_id, user_email, dataset_id, mode_input, subreddit, selected_posts, models, main_code, 
            additional_info, basis_files, themes, selected_themes, 
            codebook, references_data, code_responses, final_code_responses, 
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(workspace_id, user_email) DO UPDATE SET
            dataset_id = excluded.dataset_id,
            mode_input = excluded.mode_input,
            subreddit = excluded.subreddit,
            models = excluded.models,
            main_code = excluded.main_code,
            additional_info = excluded.additional_info,
            selected_posts = excluded.selected_posts,
            basis_files = excluded.basis_files,
            themes = excluded.themes,
            selected_themes = excluded.selected_themes,
            codebook = excluded.codebook,
            references_data = excluded.references_data,
            code_responses = excluded.code_responses,
            final_code_responses = excluded.final_code_responses,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            data.workspace_id,
            data.user_email,
            data.dataset_id,
            collection_context.mode_input,
            collection_context.subreddit,
            selected_posts,
            models,
            coding_context.main_code,
            coding_context.additional_info,
            basis_files,
            themes,
            selected_themes,
            codebook,
            references_data,
            code_responses,
            final_code_responses,
        ),
    )


def load_state(data):
    workspace_id = data.workspace_id
    user_email = data.user_email
    state = execute_query(
        """
        SELECT * FROM workspace_states 
        WHERE workspace_id = ? AND user_email = ?
        """,
        (workspace_id, user_email),
        keys=True
    )

    if not state:
        return {"success": True, "data": None}

    # print("Loading state...", state)
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

    return {"success": True, "data": state}

def delete_state(data):
    workspace_id = data.workspace_id
    user_email = data.user_email
    execute_query(
        """
        DELETE FROM workspace_states 
        WHERE workspace_id = ? AND user_email = ?
        """,
        (workspace_id, user_email)
    )
    return {"success": True}