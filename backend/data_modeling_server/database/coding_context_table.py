from models import CodingContext
from .base_class import BaseRepository

class CodingContextRepository(BaseRepository[CodingContext]):
    model = CodingContext
    def __init__(self, *args, **kwargs):
        super().__init__("coding_context", CodingContext, *args, **kwargs)
    

