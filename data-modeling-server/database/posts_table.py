from typing import List
from .base_class import BaseRepository
from models import Post

class PostsRepository(BaseRepository[Post]):
    model = Post
    def __init__(self):
        super().__init__("posts", Post)
    
    def fetch_unprocessed_posts(self, dataset_id: str, batch_size: int, num_threads: int) -> List[Post]:
        """
        Fetch posts that have not been tokenized yet.
        
        :param dataset_id: ID of the dataset to filter posts.
        :param batch_size: Number of posts to process per thread.
        :param num_threads: Number of threads processing the posts.
        :return: List of post records that are not yet tokenized.
        """
        query_builder = self.query_builder()
        query, params = query_builder.select("id", "title", "selftext") \
            .where("dataset_id", dataset_id) \
            .where("id", 
                   self.execute_raw_query("SELECT post_id FROM tokenized_posts", keys=True), 
                   operator="NOT IN") \
            .limit(batch_size * num_threads) \
            .find()

        return self.fetch_all(query, params)
    

