from typing import List
from .base_class import BaseRepository
from models import Tfidf

class TfidfRepository(BaseRepository[Tfidf]):
    model = Tfidf
    def __init__(self, dataset_id: str, *args, **kwargs):
        normalized_dataset_id = dataset_id.replace("-", "_")
        super().__init__(f"tokens_{normalized_dataset_id}", Tfidf, *args, **kwargs)