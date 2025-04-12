from typing import List
from .base_class import BaseRepository
from models import TokenStat

class TokenStatsRepository(BaseRepository[TokenStat]):
    model = TokenStat
    def __init__(self, *args, **kwargs):
        super().__init__("token_stats", TokenStat, *args, **kwargs)
    

