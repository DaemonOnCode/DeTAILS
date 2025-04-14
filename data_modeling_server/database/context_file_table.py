from models import ContextFile
from .base_class import BaseRepository

class ContextFilesRepository(BaseRepository[ContextFile]):
    model = ContextFile
    def __init__(self, *args, **kwargs):
        super().__init__("context_files", ContextFile, *args, **kwargs)
    

