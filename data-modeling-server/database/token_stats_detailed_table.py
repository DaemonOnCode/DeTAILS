from typing import List
from .base_class import BaseRepository
from .table_data_class import TokenStatDetailed

class TokenStatsDetailedRepository(BaseRepository[TokenStatDetailed]):
    def __init__(self):
        super().__init__("token_stats_detailed", TokenStatDetailed)
    

