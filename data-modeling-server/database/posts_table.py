from typing import List
from .base_class import BaseRepository
from .table_data_class import Post

class PostsRepository(BaseRepository[Post]):
    model = Post
    def __init__(self):
        super().__init__("posts", Post)
    

