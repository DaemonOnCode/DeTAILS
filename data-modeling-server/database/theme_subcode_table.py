from typing import List
from .base_class import BaseRepository
from models import ThemeCode

class ThemeCodesRepository(BaseRepository[ThemeCode]):
    model = ThemeCode
    def __init__(self):
        super().__init__("theme_codes", ThemeCode)
    

