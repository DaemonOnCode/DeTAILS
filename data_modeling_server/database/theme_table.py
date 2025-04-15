from typing import List
from .base_class import BaseRepository
from models import ThemeEntry

class ThemeEntriesRepository(BaseRepository[ThemeEntry]):
    model = ThemeEntry
    def __init__(self, *args, **kwargs):
        super().__init__("theme_entries", ThemeEntry, *args, **kwargs)
    

