from typing import List
from .base_class import BaseRepository
from models import StateDump

class StateDumpsRepository(BaseRepository[StateDump]):
    model = StateDump
    def __init__(self, *args, **kwargs):
        super().__init__("state_dumps", StateDump, *args, **kwargs)
    

