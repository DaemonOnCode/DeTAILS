from models import SelectedKeyword
from .base_class import BaseRepository

class SelectedKeywordsRepository(BaseRepository[SelectedKeyword]):
    model = SelectedKeyword
    def __init__(self, *args, **kwargs):
        super().__init__("selected_keywords", SelectedKeyword, *args, **kwargs)
    

