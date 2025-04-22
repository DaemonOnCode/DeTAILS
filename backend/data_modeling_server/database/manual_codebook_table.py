from typing import List
from .base_class import BaseRepository
from models import ManualCodebookEntry

class ManualCodebookEntriesRepository(BaseRepository[ManualCodebookEntry]):
    model = ManualCodebookEntry
    def __init__(self, *args, **kwargs):
        super().__init__("manual_codebook_entries", ManualCodebookEntry, *args, **kwargs)
    

