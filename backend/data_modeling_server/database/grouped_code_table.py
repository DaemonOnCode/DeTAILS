from database.db_helpers import tuned_connection
from .base_class import BaseRepository
from models import GroupedCodeEntry

class GroupedCodeEntriesRepository(BaseRepository[GroupedCodeEntry]):
    model = GroupedCodeEntry
    def __init__(self, *args, **kwargs):
        super().__init__("grouped_code_entries", GroupedCodeEntry, *args, **kwargs)
        self.index_grouped_code_entries()

    def index_grouped_code_entries(self):
        index_sqls = [
            """
            CREATE INDEX IF NOT EXISTS idx_grouped_code_entries_context_id
              ON grouped_code_entries(coding_context_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_grouped_code_entries_ctx_code
              ON grouped_code_entries(coding_context_id, code);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_grouped_code_entries_ctx_higher_level_code
              ON grouped_code_entries(coding_context_id, higher_level_code);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_grouped_code_entries_ctx_hl_code_id
              ON grouped_code_entries(coding_context_id, higher_level_code_id);
            """
        ]
        with tuned_connection(self.database_path) as conn:
            for sql in index_sqls:
                conn.execute(sql)
            conn.commit()
    

