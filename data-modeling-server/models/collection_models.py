from pydantic import BaseModel


class ParseDatasetRequest(BaseModel):
    dataset_id: str


class ParseRedditPostsRequest(BaseModel):
    dataset_id: str
    batch: int = 10
    offset: int = 0
    all: bool = True

class ParseRedditPostByIdRequest(BaseModel):
    datasetId: str
    postId: str