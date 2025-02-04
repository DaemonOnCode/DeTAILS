from typing import List
from .base_class import BaseRepository
from models import Post, Token

class TokensRepository(BaseRepository[Token]):
    model = Post
    def __init__(self, dataset_id: str):
        normalized_dataset_id = dataset_id.replace("-", "_")
        super().__init__(f"tokens_{normalized_dataset_id}", Token)
    

