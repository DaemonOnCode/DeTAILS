from typing import List
from .base_class import BaseRepository
from models import GroupedCode

class GroupedCodesRepository(BaseRepository[GroupedCode]):
    model = GroupedCode
    def __init__(self, *args, **kwargs):
        super().__init__("grouped_codes", GroupedCode, *args, **kwargs)
    

