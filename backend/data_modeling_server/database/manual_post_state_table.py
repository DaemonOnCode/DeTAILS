from typing import List
from .base_class import BaseRepository
from models import ManualPostState

class ManualPostStatesRepository(BaseRepository[ManualPostState]):
    model = ManualPostState
    def __init__(self, *args, **kwargs):
        super().__init__("manual_post_states", ManualPostState, *args, **kwargs)
    

