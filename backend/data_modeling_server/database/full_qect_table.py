from typing import List
from .base_class import BaseRepository
from models import QectResponse

class FullQectRepository(BaseRepository[QectResponse]):
    model = QectResponse
    def __init__(self, *args, **kwargs):
        super().__init__("full_qect", QectResponse, *args, **kwargs)
    

