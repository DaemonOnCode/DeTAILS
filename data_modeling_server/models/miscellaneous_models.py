
from pydantic import BaseModel


class RedditPostLinkRequest(BaseModel):
    postId: str
    commentSlice: str
    datasetId: str


class RedditPostByIdRequest(BaseModel):
    postId: str
    datasetId: str


class RedditPostIDAndTitleRequestBatch(BaseModel):
    post_ids: list = None
    dataset_id: str


class RedditPostIDAndTitleRequest(BaseModel):
    post_id: str
    dataset_id: str

class UserCredentialTestRequest(BaseModel):
    provider: str
    credential: str

class ModelTestRequest(BaseModel):
    provider: str
    name: str

class EmbeddingTestRequest(BaseModel):
    provider: str
    name: str

class FunctionProgressRequest(BaseModel):
    workspace_id: str
    dataset_id: str
    name: str