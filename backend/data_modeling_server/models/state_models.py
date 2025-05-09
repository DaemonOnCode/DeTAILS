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

class LoadingContext(BaseModel):
    page_state: dict = {}
