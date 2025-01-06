from typing import Any, Dict
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
    main_code: str = ""
    additional_info: str = ""
    basis_files: dict = {}
    themes: list = []
    selected_themes: list = []
    codebook: list = []
    references: dict = {}
    code_responses: list = []
    final_code_responses: list = []

