from typing import List
from .base_class import BaseRepository
from .table_data_class import LlmResponse

class LlmResponsesRepository(BaseRepository[LlmResponse]):
    def __init__(self):
        super().__init__("llm_responses", LlmResponse)
    

