from typing import List
from .base_class import BaseRepository
from .table_data_class import TokenizedPost

class TokenizedPostsRepository(BaseRepository[TokenizedPost]):
    def __init__(self):
        super().__init__("tokenized_posts", TokenizedPost)
    

