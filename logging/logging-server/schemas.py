from pydantic import BaseModel
from typing import Literal, Optional, List
from datetime import datetime

class LogCreate(BaseModel):
    sender: Literal["ELECTRON", "REACT"]
    email: str
    level: str
    message: str
    timestamp: datetime
    context: Optional[dict] = None

class LogResponse(BaseModel):
    id: int
    sender: Literal["ELECTRON", "REACT"]
    email: str
    level: str
    message: str
    context: Optional[dict] = None
    timestamp: datetime
    current_timestamp: datetime

    class Config:
        from_attributes = True

