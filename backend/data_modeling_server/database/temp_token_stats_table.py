from typing import List
from .base_class import BaseRepository
from models import TempTokenStat

class TempTokenStatsRepository(BaseRepository[TempTokenStat]):
    model = TempTokenStat
    def __init__(self, dataset_id: str, *args, **kwargs):
        normalized_dataset_id = dataset_id.replace("-", "_")
        super().__init__(f"tokens_{normalized_dataset_id}", TempTokenStat, *args, **kwargs)