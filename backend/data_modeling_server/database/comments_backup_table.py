from typing import List
from .base_class import BaseRepository
from models import Comment

class CommentsBackupRepository(BaseRepository[Comment]):
    model = Comment
    def __init__(self, workspace_id: str, *args, **kwargs):
        normalized_workspace_id = workspace_id.replace("-", "_")
        super().__init__(f"comments_backup_{normalized_workspace_id}", Comment, *args, **kwargs)
    

