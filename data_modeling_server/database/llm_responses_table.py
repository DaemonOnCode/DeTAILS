from typing import List
from .base_class import BaseRepository
from models import LlmResponse

class LlmResponsesRepository(BaseRepository[LlmResponse]):
    model = LlmResponse
    def __init__(self, *args, **kwargs):
        super().__init__("llm_responses", LlmResponse, *args, **kwargs)
    

