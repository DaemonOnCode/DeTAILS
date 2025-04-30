
from pydantic import BaseModel


class RedditPostLinkRequest(BaseModel):
    postId: str
    commentSlice: str
    workspaceId: str


class RedditPostByIdRequest(BaseModel):
    postId: str
    workspaceId: str


class RedditPostIDAndTitleRequestBatch(BaseModel):
    post_ids: list = None
    workspace_id: str


class RedditPostIDAndTitleRequest(BaseModel):
    post_id: str
    workspace_id: str

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
    workspace_id: str
    name: str