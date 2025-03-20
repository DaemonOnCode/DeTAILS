from typing import List
from .base_class import BaseRepository
from models import QECTResponse

class QECTRepository(BaseRepository[QECTResponse]):
    model = QECTResponse
    def __init__(self):
        super().__init__("q_e_c_t", QECTResponse)
    

