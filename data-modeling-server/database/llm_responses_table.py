from typing import List
from .base_class import BaseRepository
from .table_dataclass import LlmResponse

class LlmResponsesRepository(BaseRepository[LlmResponse]):
    model = LlmResponse
    def __init__(self):
        super().__init__("llm_responses", LlmResponse)
    

