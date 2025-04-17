from typing import List
from .base_class import BaseRepository
from models import Rule

class RulesRepository(BaseRepository[Rule]):
    model = Rule
    def __init__(self, *args, **kwargs):
        super().__init__("rules", Rule, *args, **kwargs)
    

