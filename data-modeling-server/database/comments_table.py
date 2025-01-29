from typing import List
from .base_class import BaseRepository
from .table_data_class import Comment

class CommentsRepository(BaseRepository[Comment]):
    def __init__(self):
        super().__init__("comments", Comment)
    

