
from typing import List, Optional
from pydantic import BaseModel


class BaseCodingRouteRequest(BaseModel):
    model: str


class SamplePostsRequest(BaseModel):
    post_ids: list= []
    sample_size: float = 0.5
    random_seed: int = 42
    divisions: int  = 2

class SelectedPostIdsRequest(BaseModel):
    pass
    
class RegenerateKeywordsRequest(BaseCodingRouteRequest):
    extraFeedback: str = ""


class GenerateInitialCodesRequest(BaseCodingRouteRequest):
    pass


class FinalCodingRequest(BaseCodingRouteRequest):
    pass

  
class ThemeGenerationRequest(BaseCodingRouteRequest):
    pass

class RedoThemeGenerationRequest(ThemeGenerationRequest):
    feedback: str = ""


class RefineCodeRequest(BaseModel):
    chat_history: list
    code: str
    quote: str
    post_id: str
    model: str
    dataset_id: str


class RemakeCodebookRequest(GenerateInitialCodesRequest):
    feedback: str = ""


class RemakeFinalCodesRequest(FinalCodingRequest):
    feedback: str = ""

class GroupCodesRequest(BaseCodingRouteRequest):
    pass

class RegroupCodesRequest(GroupCodesRequest):
    feedback: str = ""
    previous_codes: list = []

class GenerateCodebookWithoutQuotesRequest(BaseCodingRouteRequest):
    pass

class RegenerateCodebookWithoutQuotesRequest(GenerateCodebookWithoutQuotesRequest):
    feedback: str = ""


class GenerateDeductiveCodesRequest(BaseModel):
    model: str
    codebook: dict
    post_ids: list

class GenerateKeywordDefinitionsRequest(BaseModel):
    model: str

class GetCodedDataRequest(BaseModel):
    codebook_names: list
    filters: dict
    batch_size: int = 20
    offset: int = 0


class ResponsesRequest(BaseModel):
    page: int
    pageSize: int
    responseTypes: List[str]
    selectedTypeFilter: Optional[str] = None
    filter: Optional[str] = None
    filterType: Optional[str] = None

class FilteredResponsesMetadataRequest(BaseModel):
    selectedTypeFilter: str
    filter: Optional[str] = None
    filterType: Optional[str] = None
    responseTypes: List[str]

class PostResponsesRequest(BaseModel):
    postId: str
    responseTypes: List[str]
