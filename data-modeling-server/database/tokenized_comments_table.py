from typing import List
from .base_class import BaseRepository
from .table_data_class import LlmResponses, TokenizedComment

class TokenizedCommentsRepository(BaseRepository[TokenizedComment]):
    def __init__(self):
        super().__init__("tokenized_comments", TokenizedComment)
    

