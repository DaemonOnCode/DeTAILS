from typing import List
from .base_class import BaseRepository
from models import TokenStatDetailed

class TokenStatsDetailedRepository(BaseRepository[TokenStatDetailed]):
    model = TokenStatDetailed
    def __init__(self):
        super().__init__("token_stats_detailed", TokenStatDetailed)
    

