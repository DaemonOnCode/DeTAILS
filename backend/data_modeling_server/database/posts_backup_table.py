from typing import List

from .base_class import BaseRepository
from models import Post

class PostsBackupRepository(BaseRepository[Post]):
    model = Post
    def __init__(self, workspace_id: str, *args, **kwargs):
        normalized_workspace_id = workspace_id.replace("-", "_")
        super().__init__(f"posts_backup_{normalized_workspace_id}", Post, *args, **kwargs)
    

