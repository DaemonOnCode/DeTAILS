from typing import List
from .base_class import BaseRepository
from models import Comment

class CommentsRepository(BaseRepository[Comment]):
    model = Comment
    def __init__(self, *args, **kwargs):
        super().__init__("comments", Comment, *args, **kwargs)

    def fetch_unprocessed_comments(self, dataset_id: str, batch_size: int, num_threads: int):
        tokenized_comment_ids = list(map(lambda x: x["comment_id"], self.execute_raw_query("SELECT comment_id FROM tokenized_comments", keys=True)))

        query_builder = self.query_builder()
        query, params = query_builder.select("id", "body") \
            .where("dataset_id", dataset_id) \
            .where("id", 
                   tokenized_comment_ids, 
                   operator="NOT IN") \
            .limit(batch_size * num_threads) \
            .find()

        print(query, params)
        return self.fetch_all(query, params, map_to_model=False)
    
    def get_comments_by_post_optimized(self, dataset_id: str, post_id: str):
        query = """WITH RECURSIVE comment_tree AS (
        SELECT id, parent_id, author, body, 0 AS depth
        FROM comments
        WHERE post_id = ? 
            AND dataset_id = ?
            AND (parent_id IS NULL OR parent_id = post_id)
        UNION ALL
        SELECT c.id, c.parent_id, c.author, c.body, ct.depth + 1
        FROM comments c
        INNER JOIN comment_tree ct ON c.parent_id = ct.id
        WHERE c.dataset_id = ?
        )
        SELECT * FROM comment_tree;
        """
        rows = self.execute_raw_query(query, (post_id, dataset_id, dataset_id), keys=True)
        return rows

