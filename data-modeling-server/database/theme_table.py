from typing import List
from .base_class import BaseRepository
from models import Theme

class ThemesRepository(BaseRepository[Theme]):
    model = Theme
    def __init__(self, *args, **kwargs):
        super().__init__("themes", Theme, *args, **kwargs)
    

