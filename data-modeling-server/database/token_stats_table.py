from typing import List
from .base_class import BaseRepository
from .table_data_class import TokenStat

class TokenStatsRepository(BaseRepository[TokenStat]):
    model = TokenStat
    def __init__(self):
        super().__init__("token_stats", TokenStat)
    

