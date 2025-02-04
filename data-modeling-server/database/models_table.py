from typing import List
from .base_class import BaseRepository
from models import Model

class ModelsRepository(BaseRepository[Model]):
    model = Model
    def __init__(self):
        super().__init__("models", Model)
    

