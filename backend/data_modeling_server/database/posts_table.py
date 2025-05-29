from typing import List

from database.db_helpers import tuned_connection
from .base_class import BaseRepository
from models import Post

class PostsRepository(BaseRepository[Post]):
    model = Post
    def __init__(self, *args, **kwargs):
        super().__init__("posts", Post, *args, **kwargs)
        self.index_posts()
    
    def fetch_unprocessed_posts(self, workspace_id: str, batch_size: int, num_threads: int):
        tokenized_post_ids = list(map(lambda x: x["post_id"], self.execute_raw_query("SELECT post_id FROM tokenized_posts", keys=True)))


        query_builder = self.query_builder()
        query, params = query_builder.select("id", "title", "selftext") \
            .where("workspace_id", workspace_id) \
            .where("id", 
                   tokenized_post_ids, 
                   operator="NOT IN") \
            .limit(batch_size * num_threads) \
            .find()
        
        print(query, params)

        return self.fetch_all(query, params, map_to_model=False)
    
    def get_filtered_post_ids(self, workspace_id: str) -> List[str]:
        query = """
    SELECT p.id
    FROM posts p
    LEFT JOIN comments c
      ON c.post_id = p.id
    WHERE p.workspace_id = ?
      AND (p.title IN ('[removed]', '[deleted]') OR p.selftext IN ('[removed]', '[deleted]'))
      AND c.id IS NULL
    """
        rows = self.execute_raw_query(query, (workspace_id,workspace_id), keys=True)

        return [row['id'] for row in rows]
    
    def index_posts(self):
        index_sqls = [ 
        """
        CREATE INDEX IF NOT EXISTS idx_posts_by_workspace
        ON posts(workspace_id);
        """,
        ]
        with tuned_connection(self.database_path) as conn:
            for sql in index_sqls:
                conn.execute(sql)
                conn.commit()

    

