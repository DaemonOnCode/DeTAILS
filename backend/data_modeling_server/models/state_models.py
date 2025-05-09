from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class SaveStateRequest(BaseModel):
    workspace_id: str
    user_email: str
    workspace_id: str
    page_url: str = "/"
    loading_context: Dict[str, Any]

class LoadStateRequest(BaseModel):
    workspace_id: str
    user_email: str


class CollectionContext(BaseModel):
    type: str = ""
    metadata: dict = {}
    mode_input: str = ""
    selected_data: list = []
    data_filters: dict = {}
    is_locked: bool = False

class CodingContext(BaseModel):
    main_topic: Optional[str] = None
    additional_info: Optional[str] = None
    context_files: dict = {}
    concepts: list = []
    selected_concepts: list = []
    concept_table: list = []
    references_data: dict = {}
    themes: list = []
    grouped_codes: list = []
    research_questions: list = []
    sampled_post_responses: list = []
    sampled_post_with_themes_responses: list = []
    unseen_post_response: list = []
    unplaced_codes: list = []
    unplaced_subcodes: list = []
    sampled_post_ids: list = []
    unseen_post_ids: list = []
    conflicting_responses: list = []
    initial_codebook: list = []

class LoadingContext(BaseModel):
    page_state: dict = {}