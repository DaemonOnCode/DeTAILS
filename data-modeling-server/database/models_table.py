from typing import List
from .base_class import BaseRepository
from .table_data_class import Model

class ModelsRepository(BaseRepository[Model]):
    def __init__(self):
        super().__init__("models", Model)
    

