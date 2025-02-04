from typing import List
from .base_class import BaseRepository
from models import Comment

class CommentsRepository(BaseRepository[Comment]):
    model = Comment
    def __init__(self):
        super().__init__("comments", Comment)

    def fetch_unprocessed_comments(self, dataset_id: str, batch_size: int, num_threads: int):
        """
        Fetch comments that have not been tokenized yet.
        
        :param dataset_id: ID of the dataset to filter comments.
        :param batch_size: Number of comments to process per thread.
        :param num_threads: Number of threads processing the comments.
        :return: List of comment records that are not yet tokenized.
        """

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
    

