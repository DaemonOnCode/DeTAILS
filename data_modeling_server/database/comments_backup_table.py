from typing import List
from .base_class import BaseRepository
from models import Comment

class CommentsBackupRepository(BaseRepository[Comment]):
    model = Comment
    def __init__(self, dataset_id: str, *args, **kwargs):
        normalized_dataset_id = dataset_id.replace("-", "_")
        super().__init__(f"comments_backup_{normalized_dataset_id}", Comment, *args, **kwargs)
    

