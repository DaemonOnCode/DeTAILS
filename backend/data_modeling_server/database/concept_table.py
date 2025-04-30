from models import Concept
from .base_class import BaseRepository

class ConceptsRepository(BaseRepository[Concept]):
    model = Concept
    def __init__(self, *args, **kwargs):
        super().__init__("concepts", Concept, *args, **kwargs)
    

