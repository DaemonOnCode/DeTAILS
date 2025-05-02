
from typing import Any, Dict, List, Literal, Optional
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
    
class RegenerateConceptsRequest(BaseCodingRouteRequest):
    extraFeedback: str = ""


class GenerateInitialCodesRequest(BaseCodingRouteRequest):
    pass


class GenerateFinalCodesRequest(BaseCodingRouteRequest):
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


class RedoInitialCodingRequest(GenerateInitialCodesRequest):
    feedback: str = ""


class RedoFinalCodingRequest(GenerateFinalCodesRequest):
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

class GenerateConceptDefinitionsRequest(BaseModel):
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


class PaginatedRequest(BaseModel):
    page: int
    pageSize: int
    filterCode: Optional[str] = None
    searchTerm: Optional[str] = None
    selectedTypeFilter: Literal["New Data", "Codebook", "Human", "LLM", "All"]
    postId: Optional[str] = None     
    responseTypes: List[str] = []
    markedTrue: bool = False
    

class PaginatedPostsResponse(BaseModel):
    postIds: List[str]
    titles: Dict[str,str]
    total: int
    hasNext: bool
    hasPrevious: bool

class PaginatedPostRequest(BaseModel):
    page: int
    pageSize: int
    responseTypes: List[str]               
    searchTerm: str | None = None
    onlyCoded: bool = False
    selectedTypeFilter: str | None = "New Data"


class TranscriptRequest(BaseModel):
    postId: str
    responseTypes: List[str]
    manualCoding: bool = False

class AnalysisRequest(BaseModel):
    viewType: Literal['post', 'code']
    summary: bool = False
    page: int = 1
    pageSize: int = 20
    searchTerm: Optional[str] = None

class PaginationMeta(BaseModel):
    totalItems: int
    hasNext: bool
    hasPrevious: bool
