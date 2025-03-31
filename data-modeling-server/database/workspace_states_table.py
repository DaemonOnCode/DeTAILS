from typing import List
from .base_class import BaseRepository
from models import WorkspaceState

class WorkspaceStatesRepository(BaseRepository[WorkspaceState]):
    model = WorkspaceState
    def __init__(self, *args, **kwargs):
        super().__init__("workspace_states", WorkspaceState, *args, **kwargs)
    

