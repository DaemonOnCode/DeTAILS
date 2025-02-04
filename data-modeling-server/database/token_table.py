from .base_class import BaseRepository
from models import Token

class TokensRepository(BaseRepository[Token]):
    model = Token
    def __init__(self, dataset_id: str):
        normalized_dataset_id = dataset_id.replace("-", "_")
        super().__init__(f"tokens_{normalized_dataset_id}", Token)
    

