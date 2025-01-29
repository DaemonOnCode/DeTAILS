from typing import List
from .base_class import BaseRepository
from .table_data_class import Rule

class RulesRepository(BaseRepository[Rule]):
    def __init__(self):
        super().__init__("rules", Rule)
    

