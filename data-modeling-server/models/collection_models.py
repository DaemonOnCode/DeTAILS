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

class FilterRedditPostsByDeleted(BaseModel):
    dataset_id: str

class ParseRedditFromTorrentRequest(BaseModel):
    subreddit: str
    dataset_id: str
    workspace_id: str
    start_date: str = "2005-06-01"
    end_date: str = "2023-12-31"
    submissions_only: bool = False

class ParseRedditFromTorrentFilesRequest(BaseModel):
    subreddit: str
    files: list = []
    dataset_id: str

class GetTorrentStatusRequest(BaseModel):
    workspace_id: str
    dataset_id: str