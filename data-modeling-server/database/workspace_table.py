from typing import List
from .base_class import BaseRepository
from .table_data_class import Workspaces

class WorkspacesRepository(BaseRepository[Workspaces]):
    def __init__(self):
        super().__init__("workspaces", Workspaces)

    def find_by_user_email(self, user_email: str) -> List[Workspaces]:
        """
        Finds workspaces by user email.
        """
        query, params = self.query_builder().where("user_email", user_email).build()
        return self.fetch_all(query, params)

    def find_recent_workspaces(self, user_email: str, limit: int = 5) -> List[Workspaces]:
        """
        Finds recent workspaces for a user, limited by count.
        """
        query, params = (
            self.query_builder()
            .where("", user_email)
            .order_by("created_at", descending=True)
            .limit(limit)
            .build()
        )
        return self.fetch_all(query, params)
