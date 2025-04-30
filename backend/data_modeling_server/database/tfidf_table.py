from typing import List
from .base_class import BaseRepository
from models import Tfidf

class TfidfRepository(BaseRepository[Tfidf]):
    model = Tfidf
    def __init__(self, workspace_id: str, *args, **kwargs):
        normalized_workspace_id = workspace_id.replace("-", "_")
        super().__init__(f"tokens_{normalized_workspace_id}", Tfidf, *args, **kwargs)