from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class SaveStateRequest(BaseModel):
    workspace_id: str
    user_email: str
    dataset_id: str
    coding_context: Dict[str, Any]
    collection_context: Dict[str, Any]
    modeling_context: Dict[str, Any]

class LoadStateRequest(BaseModel):
    workspace_id: str
    user_email: str


class CollectionContext(BaseModel):
    mode_input: str = ""
    subreddit: str = ""
    selected_posts: list = []

class ModelingContext(BaseModel):
    models: list = []

class CodingContext(BaseModel):
    main_topic: Optional[str] = None
    additional_info: Optional[str] = None
    context_files: dict = {}
    keywords: list = []
    selected_keywords: list = []
    keyword_table: list = []
    references_data: dict = {}
    themes: list = []
    research_questions: list = []
    sampled_post_responses: list = []
    sampled_post_with_themes_responses: list = []
    unseen_post_response: list = []
    unplaced_codes: list = []
    sampled_post_ids: list = []
    unseen_post_ids: list = []
    conflicting_responses: list = []

