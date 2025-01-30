from typing import List
from .base_class import BaseRepository
from .table_data_class import Dataset

class DatasetsRepository(BaseRepository[Dataset]):
    model = Dataset
    def __init__(self):
        super().__init__("datasets", Dataset)
    

