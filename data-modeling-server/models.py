from pydantic import BaseModel
from typing import List, Dict


class Rule(BaseModel):
    type: str  # "include" or "remove"
    value: str


class Dataset(BaseModel):
    id: str
    name: str
    tokens: List[Dict[str, str]]  # List of tokens, each with "text", "pos", etc.
    filtered_tokens: List[Dict[str, str]] = []
