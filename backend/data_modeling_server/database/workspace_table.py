from typing import List
from .base_class import BaseRepository
from models import Workspace

class WorkspacesRepository(BaseRepository[Workspace]):
    model = Workspace
    def __init__(self, *args, **kwargs):
        super().__init__("workspaces", Workspace, *args, **kwargs)

    def find_by_user_email(self, user_email: str) -> List[Workspace]:
        query, params = self.query_builder().where("user_email", user_email).find()
        return self.fetch_all(query, params)

    def find_recent_workspaces(self, user_email: str, limit: int = 5) -> List[Workspace]:
        query, params = (
            self.query_builder()
            .where("", user_email)
            .order_by("created_at", descending=True)
            .limit(limit)
            .find()
        )
        return self.fetch_all(query, params)
