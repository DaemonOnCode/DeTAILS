from pydantic import BaseModel
from typing import Optional

class WorkspaceCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    user_email: str

class WorkspaceUpdateRequest(BaseModel):
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
