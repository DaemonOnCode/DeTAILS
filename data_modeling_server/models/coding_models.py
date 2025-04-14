
from typing import Optional
from pydantic import BaseModel


class SamplePostsRequest(BaseModel):
    dataset_id: str
    post_ids: list= []
    sample_size: int = 0.5
    random_seed: int = 42
    divisions: int  = 2

class SelectedPostIdsRequest(BaseModel):
    dataset_id: str
    
class RegenerateKeywordsRequest(BaseModel):
    model: str
    # mainTopic: str
    # additionalInfo: str = ""
    # researchQuestions: list
    # selectedKeywords: list
    # unselectedKeywords: list
    extraFeedback: str = ""
    # datasetId: str 


class GenerateInitialCodesRequest(BaseModel):
    dataset_id: str
    keyword_table: list
    model: str
    main_topic: str
    additional_info: str
    research_questions: list
    sampled_post_ids: list

    
class CodebookRefinementRequest(BaseModel):
    dataset_id: str
    model: str
    prevCodebook: list
    currentCodebook: list


class DeductiveCodingRequest(BaseModel):
    dataset_id: str
    model: str
    final_codebook: list
    keyword_table: list
    main_topic: str
    additional_info: Optional[str] = ""
    research_questions: Optional[list] = []
    unseen_post_ids: list

  
class ThemeGenerationRequest(BaseModel):
    dataset_id: str
    model: str
    sampled_post_responses: list
    unseen_post_responses: list

class RedoThemeGenerationRequest(ThemeGenerationRequest):
    feedback: str = ""
    previous_themes: list = []


class RefineCodeRequest(BaseModel):
    chat_history: list
    code: str
    quote: str
    post_id: str
    model: str
    dataset_id: str


class RemakeCodebookRequest(GenerateInitialCodesRequest):
    codebook: list
    feedback: str = ""


class RemakeDeductiveCodesRequest(DeductiveCodingRequest):
    current_codebook: list
    feedback: str = ""

class GroupCodesRequest(BaseModel):
    dataset_id: str
    model: str
    sampled_post_responses: list
    unseen_post_responses: list

class RegroupCodesRequest(GroupCodesRequest):
    feedback: str = ""
    previous_codes: list = []

class GenerateCodebookWithoutQuotesRequest(BaseModel):
    dataset_id: str
    model: str
    sampled_post_responses: list
    unseen_post_responses: list

class RegenerateCodebookWithoutQuotesRequest(GenerateCodebookWithoutQuotesRequest):
    feedback: str = ""
    previous_codebook: list = []


class GenerateDeductiveCodesRequest(BaseModel):
    dataset_id: str
    model: str
    codebook: dict
    post_ids: list

class GenerateKeywordDefinitionsRequest(BaseModel):
    # dataset_id: str
    model: str
    # main_topic: str
    # additional_info: str
    # research_questions: list 
    # selected_words: list

class GetCodedDataRequest(BaseModel):
    dataset_id: str
    codebook_names: list
    filters: dict
    batch_size: int = 20
    offset: int = 0