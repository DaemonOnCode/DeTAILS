
from typing import List, Optional
from pydantic import BaseModel


class DatasetIdRequest(BaseModel):
    dataset_id: str

class DatasetTokenRequest(BaseModel):
    dataset_id: str
    tokens: Optional[List[str]] = None

class RulesRequest(BaseModel):
    dataset_id: str
    rules: Optional[List[dict]] = None

class ProcessBatchRequest(BaseModel):
    dataset_id: str
    batch_size: Optional[int] = 100
    thread_count: Optional[int] = 8

class Rule(BaseModel):
    id: Optional[int] = None
    step: int
    fields: str
    words: str
    pos: Optional[str] = None
    action: str

class DatasetRequest(BaseModel):
    dataset_id: str
    rules: list