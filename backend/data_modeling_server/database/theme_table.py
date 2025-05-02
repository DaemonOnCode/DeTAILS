from database.db_helpers import tuned_connection
from .base_class import BaseRepository
from models import ThemeEntry

class ThemeEntriesRepository(BaseRepository[ThemeEntry]):
    model = ThemeEntry
    def __init__(self, *args, **kwargs):
        super().__init__("theme_entries", ThemeEntry, *args, **kwargs)
        self.index_theme_entries()

    def index_theme_entries(self):
        index_sqls = [
            """
            CREATE INDEX IF NOT EXISTS idx_theme_entries_context_id
                ON theme_entries(coding_context_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_theme_entries_ctx_higher_level_code
                ON theme_entries(coding_context_id, higher_level_code);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_theme_entries_ctx_theme_id
                ON theme_entries(coding_context_id, theme_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_theme_entries_ctx_theme
                ON theme_entries(coding_context_id, theme);
            """
        ]
        with tuned_connection(self.database_path) as conn:
            for sql in index_sqls:
                conn.execute(sql)
            conn.commit()
    

