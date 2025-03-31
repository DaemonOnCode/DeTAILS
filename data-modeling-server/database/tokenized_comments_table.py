from typing import List
from .base_class import BaseRepository
from models import TokenizedComment

class TokenizedCommentsRepository(BaseRepository[TokenizedComment]):
    model = TokenizedComment
    def __init__(self, *args, **kwargs):
        super().__init__("tokenized_comments", TokenizedComment, *args, **kwargs)
    

