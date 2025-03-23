from typing import List
from .base_class import BaseRepository
from models import LlmFunctionArgs

class LlmFunctionArgsRepository(BaseRepository[LlmFunctionArgs]):
    model = LlmFunctionArgs
    def __init__(self):
        super().__init__("llm_function_args", LlmFunctionArgs)
    