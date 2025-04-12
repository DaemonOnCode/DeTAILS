from pydantic import BaseModel
from typing import List

class TextData(BaseModel):
    documents: List[str]
    num_topics: int