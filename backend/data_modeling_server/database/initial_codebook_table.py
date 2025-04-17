from models import InitialCodebookEntry
from .base_class import BaseRepository

class InitialCodebookEntriesRepository(BaseRepository[InitialCodebookEntry]):
    model = InitialCodebookEntry
    def __init__(self, *args, **kwargs):
        super().__init__("initial_codebook_entries", InitialCodebookEntry, *args, **kwargs)
    

