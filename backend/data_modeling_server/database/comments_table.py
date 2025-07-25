from database.db_helpers import tuned_connection
from .base_class import BaseRepository
from models import Comment

class CommentsRepository(BaseRepository[Comment]):
    model = Comment
    def __init__(self, *args, **kwargs):
        super().__init__("comments", Comment, *args, **kwargs)
        self.index_comments()

    def fetch_unprocessed_comments(self, workspace_id: str, batch_size: int, num_threads: int):
        tokenized_comment_ids = list(map(lambda x: x["comment_id"], self.execute_raw_query("SELECT comment_id FROM tokenized_comments", keys=True)))

        query_builder = self.query_builder()
        query, params = query_builder.select("id", "body") \
            .where("workspace_id", workspace_id) \
            .where("id", 
                   tokenized_comment_ids, 
                   operator="NOT IN") \
            .limit(batch_size * num_threads) \
            .find()

        print(query, params)
        return self.fetch_all(query, params, map_to_model=False)
    
    def index_comments(self):
        index_sqls = [ 
        """
        CREATE INDEX IF NOT EXISTS idx_comments_dataset_post_parent
        ON comments(workspace_id, post_id, parent_id);
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_comments_dataset_parent
        ON comments(workspace_id, parent_id);
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_comments_by_post
        ON comments(workspace_id, post_id);
        """,
        """
        CREATE INDEX IF NOT EXISTS idx_comments_good
        ON comments(workspace_id, post_id)
        WHERE body IS NOT NULL
            AND TRIM(body) <> ''
            AND body NOT IN ('[removed]', '[deleted]');
        """,
        ]
        with tuned_connection(self.database_path) as conn:
            for sql in index_sqls:
                conn.execute(sql)
                conn.commit()
    
    def get_comments_by_post_optimized(self, workspace_id: str, post_id: str):
        recursive_sql = """
        WITH RECURSIVE comment_tree AS (
        SELECT
            id,
            body,
            author,
            parent_id,
            post_id,
            0 AS depth
        FROM comments
        WHERE
            post_id    = ?
            AND workspace_id = ?
            AND parent_id  = post_id

        UNION ALL
        SELECT
            c.id,
            c.body,
            c.author,
            c.parent_id,
            c.post_id,
            ct.depth + 1
        FROM comments AS c
        JOIN comment_tree AS ct
            ON c.parent_id = ct.id
        WHERE
            c.workspace_id = ?
        )
        SELECT *
        FROM comment_tree;
        """

        rows = self.execute_raw_query(
            recursive_sql,
            (post_id, workspace_id, workspace_id),
            keys=True
        )
        print(rows)
        return rows or []

