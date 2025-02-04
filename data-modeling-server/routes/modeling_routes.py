import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import sqlite3
from typing import List
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Path
from numpy import add
import psutil
from pydantic import BaseModel
import spacy
from controllers.modeling_controller import MODEL_FUNCTIONS, process_topic_modeling
from database.models_table import ModelsRepository
from decorators.execution_time_logger import log_execution_time
from models.modeling_models import MetadataRequest, ModelListRequest, TopicModelingRequest, UpdateMetadataRequest
from routes.websocket_routes import manager, ConnectionManager
from constants import DATABASE_PATH
from utils.topic_modeling import lda_topic_modeling, biterm_topic_modeling, nnmf_topic_modeling, bertopic_modeling, llm_topic_modeling
from spacy.language import Language

router = APIRouter()

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import pandas as pd


models_repo = ModelsRepository()
# main_event_loop = asyncio.get_event_loop()

# # Batch Tokenization Function
# def preprocess_tokenization_batch(nlp, data: List[str]) -> List[List[str]]:
#     """
#     Tokenize a batch of text data efficiently, skipping stop words.
#     """
#     if not data:
#         return []

#     docs = nlp.pipe(data,  n_process=4)  # Batch process
#     return [[token.text for token in doc if not token.is_stop] for doc in docs]


# Dynamic route to handle topic modeling methods
@router.post("/model/{method}")
@log_execution_time()
async def topic_model(
    method: str = Path(..., description="The topic modeling method to use"),
    request: TopicModelingRequest = None
):
    modeling_function = MODEL_FUNCTIONS.get(method)

    if not modeling_function:
        raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

    return await process_topic_modeling(request, manager, method, modeling_function)



@router.post("/metadata")
@log_execution_time()
def get_metadata_for_model(request: MetadataRequest):
    if not request.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        print(request.model_id, request.dataset_id, request.workspace_id)
        model_result = models_repo.find_one({
            "id": request.model_id,
            "dataset_id": request.dataset_id
        })
        if not model_result:
            raise HTTPException(status_code=404, detail="Model not found.")

        print(model_result) 

        return {
            "id": model_result.id,
            "model_name": model_result.model_name,
            "type": model_result.method,
            "num_topics": model_result.num_topics,
            "start_time": model_result.started_at,
            "end_time": model_result.finished_at,
            "stage": model_result.stage,
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/model")
@log_execution_time()
def update_metadata_for_model(request: UpdateMetadataRequest):
    model_id = request.model_id
    dataset_id = request.dataset_id
    workspace_id = request.workspace_id
    new_model_name = request.new_model_name
    print("Update", model_id, dataset_id, workspace_id, new_model_name)
    if not model_id or not dataset_id or not workspace_id:
        raise HTTPException(status_code=400, detail="Model ID is required.")
    try:
        model_result = models_repo.update({"id": model_id, "dataset_id": dataset_id}, {"model_name": new_model_name})
        print(model_result)
        if not model_result:
            raise HTTPException(status_code=404, detail="Model not found.")
        return {
            "message": f"Model updated successfully."
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/model")
@log_execution_time()
def delete_model(request: MetadataRequest):
    model_id = request.model_id
    dataset_id = request.dataset_id
    workspace_id = request.workspace_id
    print("Delete", model_id, dataset_id, workspace_id)
    if not model_id or not dataset_id or not workspace_id:
        raise HTTPException(status_code=400, detail="Model ID is required.")
    try:
        model_result = models_repo.delete({"id": model_id, "dataset_id": dataset_id})
        print(model_result)
        if not model_result:
            raise HTTPException(status_code=404, detail="Model not found.")
        return {
            "message": f"Model deleted successfully."
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/list-models")
@log_execution_time()
def get_models(request: ModelListRequest):
    if not request.dataset_id or not request.workspace_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    models_result = models_repo.find({"dataset_id": request.dataset_id})
    return models_result