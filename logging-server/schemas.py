from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LogCreate(BaseModel):
    email: str
    level: str
    message: str
    cpu_usage: Optional[float] = None
    ram_usage: Optional[float] = None
    context: Optional[dict] = None

class LogResponse(BaseModel):
    id: int
    email: str
    level: str
    message: str
    cpu_usage: Optional[float] = None
    ram_usage: Optional[float] = None
    context: Optional[dict] = None
    timestamp: datetime

    class Config:
        from_attributes = True

