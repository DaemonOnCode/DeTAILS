from typing import List

from models import Dataset
from .base_class import BaseRepository


class DatasetsRepository(BaseRepository[Dataset]):
    model = Dataset
    def __init__(self, *args, **kwargs):
        super().__init__("datasets", Dataset, *args, **kwargs)
    

