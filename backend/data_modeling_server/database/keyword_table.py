from models import Keyword
from .base_class import BaseRepository

class KeywordsRepository(BaseRepository[Keyword]):
    model = Keyword
    def __init__(self, *args, **kwargs):
        super().__init__("keywords", Keyword, *args, **kwargs)
    

