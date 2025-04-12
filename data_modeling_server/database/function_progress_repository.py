from typing import List
from .base_class import BaseRepository
from models import FunctionProgress

class FunctionProgressRepository(BaseRepository[FunctionProgress]):
    model = FunctionProgress
    def __init__(self, *args, **kwargs):
        super().__init__("function_progress", FunctionProgress, *args, **kwargs)
    