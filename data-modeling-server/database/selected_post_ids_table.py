from typing import List
from .base_class import BaseRepository
from models import SelectedPostId

class SelectedPostIdsRepository(BaseRepository[SelectedPostId]):
    model = SelectedPostId
    def __init__(self):
        super().__init__("selected_post_ids", SelectedPostId)
    

