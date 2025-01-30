
import json
from models.state_models import CodingContext, CollectionContext, ModelingContext
from routes.modeling_routes import execute_query

def save_state(data):
    collection_context = CollectionContext(**data.collection_context)
    coding_context = CodingContext(**data.coding_context)
    modeling_context = ModelingContext(**data.modeling_context)

    # Convert lists and dicts to JSON strings
    selected_posts = json.dumps(collection_context.selected_posts)
    models = json.dumps(modeling_context.models)
    context_files = json.dumps(coding_context.context_files)
    keywords = json.dumps(coding_context.keywords)
    selected_keywords = json.dumps(coding_context.selected_keywords)
    keyword_table = json.dumps(coding_context.keyword_table)
    references_data = json.dumps(coding_context.references_data)
    themes = json.dumps(coding_context.themes)
    research_questions = json.dumps(coding_context.research_questions)
    sampled_post_responses = json.dumps(coding_context.sampled_post_responses)
    sampled_post_with_themes_responses = json.dumps(coding_context.sampled_post_with_themes_responses)
    unseen_post_response = json.dumps(coding_context.unseen_post_response)
    unplaced_codes = json.dumps(coding_context.unplaced_codes)
    sampled_post_ids = json.dumps(coding_context.sampled_post_ids)
    unseen_post_ids = json.dumps(coding_context.unseen_post_ids)

    # Insert or update the user context based on workspace_id and user_email
    execute_query(
        """
        INSERT INTO workspace_states (
            user_email, workspace_id, dataset_id, mode_input, subreddit, selected_posts, models, 
            main_topic, additional_info, context_files, keywords, selected_keywords, keyword_table, 
            references_data, themes, research_questions, sampled_post_responses, 
            sampled_post_with_themes_responses, unseen_post_response, unplaced_codes, 
            sampled_post_ids, unseen_post_ids ,updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(workspace_id, user_email) DO UPDATE SET
            dataset_id = excluded.dataset_id,
            mode_input = excluded.mode_input,
            subreddit = excluded.subreddit,
            selected_posts = excluded.selected_posts,
            models = excluded.models,
            main_topic = excluded.main_topic,
            additional_info = excluded.additional_info,
            context_files = excluded.context_files,
            keywords = excluded.keywords,
            selected_keywords = excluded.selected_keywords,
            keyword_table = excluded.keyword_table,
            references_data = excluded.references_data,
            themes = excluded.themes,
            research_questions = excluded.research_questions,
            sampled_post_responses = excluded.sampled_post_responses,
            sampled_post_with_themes_responses = excluded.sampled_post_with_themes_responses,
            unseen_post_response = excluded.unseen_post_response,
            unplaced_codes = excluded.unplaced_codes,
            sampled_post_ids = excluded.sampled_post_ids,
            unseen_post_ids = excluded.unseen_post_ids,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            data.user_email,
            data.workspace_id,
            data.dataset_id,
            collection_context.mode_input,
            collection_context.subreddit,
            selected_posts,
            models,
            coding_context.main_topic,
            coding_context.additional_info,
            context_files,
            keywords,
            selected_keywords,
            keyword_table,
            references_data,
            themes,
            research_questions,
            sampled_post_responses,
            sampled_post_with_themes_responses,
            unseen_post_response,
            unplaced_codes,
            sampled_post_ids,
            unseen_post_ids
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

    # Process the fetched state and convert JSON strings to Python objects
    state = state[0]
    state["selected_posts"] = json.loads(state["selected_posts"])
    state["models"] = json.loads(state["models"])
    state["context_files"] = json.loads(state["context_files"])
    state["keywords"] = json.loads(state["keywords"])
    state["selected_keywords"] = json.loads(state["selected_keywords"])
    state["keyword_table"] = json.loads(state["keyword_table"])
    state["references_data"] = json.loads(state["references_data"])
    state["themes"] = json.loads(state["themes"])
    state["research_questions"] = json.loads(state["research_questions"])
    state["sampled_post_responses"] = json.loads(state["sampled_post_responses"])
    state["sampled_post_with_themes_responses"] = json.loads(state["sampled_post_with_themes_responses"])
    state["unseen_post_response"] = json.loads(state["unseen_post_response"])
    state["unplaced_codes"] = json.loads(state["unplaced_codes"])
    state["sampled_post_ids"] = json.loads(state["sampled_post_ids"])
    state["unseen_post_ids"] = json.loads(state["unseen_post_ids"])

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