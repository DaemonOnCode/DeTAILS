from typing import List
from .base_class import BaseRepository
from models import Subcode

class SubcodesRepository(BaseRepository[Subcode]):
    model = Subcode
    def __init__(self):
        super().__init__("subcodes", Subcode)
    

