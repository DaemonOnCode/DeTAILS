from typing import List
from .base_class import BaseRepository
from .table_dataclass import Rule

class RulesRepository(BaseRepository[Rule]):
    model = Rule
    def __init__(self):
        super().__init__("rules", Rule)
    

