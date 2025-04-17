from .base_class import BaseRepository
from models import GroupedCodeEntry

class GroupedCodeEntriesRepository(BaseRepository[GroupedCodeEntry]):
    model = GroupedCodeEntry
    def __init__(self, *args, **kwargs):
        super().__init__("grouped_code_entries", GroupedCodeEntry, *args, **kwargs)
    

