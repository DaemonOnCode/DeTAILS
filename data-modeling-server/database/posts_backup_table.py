from typing import List

from .base_class import BaseRepository
from models import Post

class PostsBackupRepository(BaseRepository[Post]):
    model = Post
    def __init__(self, dataset_id: str, *args, **kwargs):
        normalized_dataset_id = dataset_id.replace("-", "_")
        super().__init__(f"posts_backup_{normalized_dataset_id}", Post, *args, **kwargs)
    

