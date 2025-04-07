from typing import List
from .base_class import BaseRepository
from models import Post

class PostsRepository(BaseRepository[Post]):
    model = Post
    def __init__(self, *args, **kwargs):
        super().__init__("posts", Post, *args, **kwargs)
    
    def fetch_unprocessed_posts(self, dataset_id: str, batch_size: int, num_threads: int):
        tokenized_post_ids = list(map(lambda x: x["post_id"], self.execute_raw_query("SELECT post_id FROM tokenized_posts", keys=True)))


        query_builder = self.query_builder()
        query, params = query_builder.select("id", "title", "selftext") \
            .where("dataset_id", dataset_id) \
            .where("id", 
                   tokenized_post_ids, 
                   operator="NOT IN") \
            .limit(batch_size * num_threads) \
            .find()
        
        print(query, params)

        return self.fetch_all(query, params, map_to_model=False)
    
    def get_filtered_post_ids(self, dataset_id: str) -> List[str]:
        query = """
    SELECT p.id
    FROM posts p
    LEFT JOIN comments c 
      ON c.post_id = p.id 
         AND c.body IS NOT NULL 
         AND TRIM(c.body) <> ''
         AND c.body NOT IN ('[removed]', '[deleted]')
    WHERE p.dataset_id = ?
      AND (p.title IN ('[removed]', '[deleted]') OR p.selftext IN ('[removed]', '[deleted]'))
      AND c.id IS NULL
    UNION
    SELECT p.id
    FROM posts p
    LEFT JOIN comments c 
      ON c.post_id = p.id
    WHERE p.dataset_id = ?
      AND p.title NOT IN ('[removed]', '[deleted]')
      AND p.selftext NOT IN ('[removed]', '[deleted]')
      AND c.id IS NULL;
    """
        rows = self.execute_raw_query(query, (dataset_id,dataset_id), keys=True)

        return [row['id'] for row in rows]

    

