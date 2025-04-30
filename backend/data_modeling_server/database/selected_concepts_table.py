from models import SelectedConcept
from .base_class import BaseRepository

class SelectedConceptsRepository(BaseRepository[SelectedConcept]):
    model = SelectedConcept
    def __init__(self, *args, **kwargs):
        super().__init__("selected_concepts", SelectedConcept, *args, **kwargs)
    

