from models import ConceptEntry
from .base_class import BaseRepository

class ConceptEntriesRepository(BaseRepository[ConceptEntry]):
    model = ConceptEntry
    def __init__(self, *args, **kwargs):
        super().__init__("concept_entries", ConceptEntry, *args, **kwargs)
    

