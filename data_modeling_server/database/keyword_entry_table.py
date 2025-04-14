from models import KeywordEntry
from .base_class import BaseRepository

class KeywordEntriesRepository(BaseRepository[KeywordEntry]):
    model = KeywordEntry
    def __init__(self, *args, **kwargs):
        super().__init__("keyword_entries", KeywordEntry, *args, **kwargs)
    

