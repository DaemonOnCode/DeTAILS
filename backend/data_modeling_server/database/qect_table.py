from typing import List

from database.db_helpers import tuned_connection
from .base_class import BaseRepository
from models import QectResponse

class QectRepository(BaseRepository[QectResponse]):
    model = QectResponse
    def __init__(self, *args, **kwargs):
        super().__init__("qect", QectResponse, *args, **kwargs)
        self.index_qect_responses()

    def index_qect_responses(self):
        index_sqls = [
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_dataset_id
            ON qect(dataset_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_workspace_id
            ON qect(workspace_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_post_id
            ON qect(post_id);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_code
            ON qect(code);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_codebook_type
            ON qect(codebook_type);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_response_type
            ON qect(response_type);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_dataset_codebook
            ON qect(dataset_id, codebook_type);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_dataset_response
            ON qect(dataset_id, response_type);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_workspace_codebook
            ON qect(workspace_id, codebook_type);
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_qect_response_workspace_response
            ON qect(workspace_id, response_type);
            """
        ]

        with tuned_connection(self.database_path) as conn:
            for sql in index_sqls:
                conn.execute(sql)
                conn.commit()
        

