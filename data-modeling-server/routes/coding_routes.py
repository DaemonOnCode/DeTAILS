from re import L
from typing import List
from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
import numpy as np
from pydantic import BaseModel

from decorators.execution_time_logger import log_execution_time


router = APIRouter()


class SamplePostsRequest(BaseModel):
    dataset_id: str
    post_ids: list= []
    sample_size: int = 0.5


@router.post("/sample-posts")
@log_execution_time()
async def sample_posts_endpoint(request_body: SamplePostsRequest):
    if request_body.sample_size <= 0 or request_body.dataset_id == "" or len(request_body.post_ids) == 0:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        sampled_post_ids = np.random.choice(request_body.post_ids, int(request_body.sample_size * len(request_body.post_ids)), replace=False)
        return {
            "sampled" :sampled_post_ids.tolist(),
            "unseen": list(set(request_body.post_ids) - set(sampled_post_ids))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

@router.post("/build-context-from-topic")
@log_execution_time()
async def build_context_from_interests_endpoint(
    request: Request,
    contextFiles: List[UploadFile],
    model: str = Form(...),
    mainTopic: str = Form(...),
    additionalInfo: str = Form(""),
    researchQuestions: List[str] = Form([]),
    retry: bool = Form(False),
    datasetId: str = Form(...)
):
    if not datasetId:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

class GenerateKeywordTableRequest(BaseModel):
    dataset_id: str
    keywords: List[str]
    selected_keywords: List[str]

@router.post("/generate-keyword-table")
@log_execution_time()
async def generate_keyword_table_endpoint(
    request_body: GenerateKeywordTableRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

class GenerateCodesRequest(BaseModel):
    dataset_id: str
    keyword_table: List[str]
    main_topic: str
    additional_info: str
    research_questions: List[str]
    sampled_post_ids: List[str]

@router.post("/generate-codes")
@log_execution_time()
async def generate_codes_endpoint(
    request_body: GenerateCodesRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
class CodebookRefinementRequest(BaseModel):
    dataset_id: str
    keyword_table: List[str]
    main_topic: str
    additional_info: str
    research_questions: List[str]
    sampled_post_ids: List[str]

@router.post("/refine-codebook")
@log_execution_time()
async def refine_codebook_endpoint(
    request_body: CodebookRefinementRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    

class DeductiveCodingRequest(BaseModel):
    dataset_id: str
    keyword_table: List[str]
    final_codebook: list
    unseen_post_ids: List[str]

@router.post("/deductive-coding")
@log_execution_time()
async def deductive_coding_endpoint(
    request_body: DeductiveCodingRequest
):
    if not request_body.dataset_id:
        raise HTTPException(status_code=400, detail="Invalid request parameters.")
    try:
        # Fetch posts
        pass
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
