from typing import List
from .base_class import BaseRepository
from models import GroupedCodeSubcode

class GroupedCodeSubcodesRepository(BaseRepository[GroupedCodeSubcode]):
    model = GroupedCodeSubcode
    def __init__(self):
        super().__init__("grouped_code_subcodes", GroupedCodeSubcode)
    

