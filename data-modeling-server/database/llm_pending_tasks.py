from typing import List
from .base_class import BaseRepository
from models import LlmPendingTask

class LlmPendingTaskRepository(BaseRepository[LlmPendingTask]):
    model = LlmPendingTask
    def __init__(self, *args, **kwargs):
        super().__init__("llm_pending_task", LlmPendingTask, *args, **kwargs)
    

