from models import CollectionContext
from .base_class import BaseRepository

class CollectionContextRepository(BaseRepository[CollectionContext]):
    model = CollectionContext
    def __init__(self, *args, **kwargs):
        super().__init__("collection_context", CollectionContext, *args, **kwargs)
    

