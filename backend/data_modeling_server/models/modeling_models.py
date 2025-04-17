
from pydantic import BaseModel


class TopicModelingRequest(BaseModel):
    num_topics: int = 10
    workspace_id: str
    dataset_id: str


class MetadataRequest(BaseModel):
    dataset_id: str
    workspace_id: str
    model_id: str


class UpdateMetadataRequest(MetadataRequest):
    new_model_name: str


class ModelListRequest(BaseModel):
    dataset_id: str
    workspace_id: str