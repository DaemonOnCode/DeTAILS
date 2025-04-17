from typing import List
from .base_class import BaseRepository
from models import QectResponse

class QectRepository(BaseRepository[QectResponse]):
    model = QectResponse
    def __init__(self, *args, **kwargs):
        super().__init__("qect", QectResponse, *args, **kwargs)
    

