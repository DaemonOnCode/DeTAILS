from .base_class import BaseRepository
from models import Token

class TokensRepository(BaseRepository[Token]):
    model = Token
    def __init__(self, workspace_id: str, *args, **kwargs):
        normalized_workspace_id = workspace_id.replace("-", "_")
        super().__init__(f"tokens_{normalized_workspace_id}", Token, *args, **kwargs)
    

