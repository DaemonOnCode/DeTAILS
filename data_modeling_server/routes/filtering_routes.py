from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
import sqlite3
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Body
import spacy
import sys
import os
import re

from constants import DATABASE_PATH
from controllers.filtering_controller import RuleApplicationService, TokenProcessingService, add_rules_to_dataset, backup_comment_table, backup_post_table, create_backup_tables, delete_rules_for_dataset, get_rules_for_dataset
from database import PostsRepository, CommentsRepository, TokenStatsDetailedRepository
from database.db_helpers import execute_query, execute_query_with_retry
from database.rules_table import RulesRepository
from models.filtering_models import DatasetIdRequest, DatasetRequest, RulesRequest


if hasattr(sys, '_MEIPASS'):
    model_path = os.path.join(sys._MEIPASS, 'spacy/data/en_core_web_sm')
else:
    model_path = 'en_core_web_sm'  

router = APIRouter()

words_repo = TokenStatsDetailedRepository()


@router.post("/datasets/rules", response_model=list)
def get_rules_endpoint(payload: DatasetIdRequest):
    rules = get_rules_for_dataset(payload.dataset_id)
    return rules

@router.post("/datasets/add-rules", response_model=dict)
def add_rules_endpoint(payload: RulesRequest):
    dataset_id = payload.dataset_id
    rules = payload.rules or []
    if dataset_id is None:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    add_rules_to_dataset(dataset_id, rules)
    return {"message": "Rules added successfully"}

@router.post("/datasets/delete-rules", response_model=dict)
def delete_all_rules_endpoint(payload: DatasetIdRequest):
    """Delete all rules for a dataset."""
    dataset_id = payload.dataset_id
    if dataset_id is None:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    delete_rules_for_dataset(dataset_id)
    return {"message": "All rules deleted successfully"}

@router.post("/datasets/backup", response_model=dict)
def create_backup_endpoint(payload: DatasetRequest = Body(...)):
    """Create backups for posts and comments."""
    dataset_id = payload.dataset_id
    backup_post_table(dataset_id)
    backup_comment_table(dataset_id)
    return {"message": "Backup created successfully"}

@router.post("/datasets/apply-rules", response_model=dict)
def apply_rules_to_dataset_parallel_endpoint(payload: Dict[str, Any]):
    dataset_id = payload.get("dataset_id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    BATCH_SIZE = 1000
    THREAD_COUNT = os.cpu_count() - 2 if os.cpu_count() else 2
    try:
        
        token_service = TokenProcessingService(dataset_id)
        rule_service = RuleApplicationService(dataset_id)
        create_backup_tables(dataset_id)
        token_service.create_token_table()
        token_service.populate_token_table_parallel(BATCH_SIZE)
        tfidf_table = token_service.compute_global_tfidf()
        
        rule_service.create_temp_table()
        rules_repo = RulesRepository()
        rules = rules_repo.find({"dataset_id": dataset_id})
        if not rules:
            raise ValueError(f"No rules found for dataset {dataset_id}")
        
        rule_service.apply_rules_parallel(token_service.tokens_repo.table_name,
                                          tfidf_table,
                                          [asdict(rule) for rule in rules],
                                          THREAD_COUNT)
        
        final_merge_query = f"""
            INSERT OR REPLACE INTO token_stats_detailed
            SELECT 
                dataset_id,
                token,
                pos,
                SUM(count_words) AS count_words,
                SUM(count_docs) AS count_docs,
                MIN(tfidf_min) AS tfidf_min,
                MAX(tfidf_max) AS tfidf_max,
                CASE 
                    WHEN SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END) > 0 THEN 'removed'
                    ELSE 'included'
                END AS status
            FROM {rule_service.temp_table}
            GROUP BY dataset_id, token, pos;
        """
        execute_query_with_retry(final_merge_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        
        rule_service.temp_repo.drop_table()
        token_service.drop_temp_tables()
    return {"message": "Rules applied successfully"}


@router.post("/datasets/processed-posts")
def get_processed_posts_endpoint(payload: DatasetIdRequest):
    """Retrieve the number of processed posts for a dataset."""
    if not payload.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")

    posts_repo = PostsRepository()
    count = posts_repo.count(filters={"dataset_id": payload.dataset_id})
    return count

@router.post("/datasets/processed-comments")
def get_processed_comments_endpoint(payload: DatasetIdRequest):
    """Retrieve the number of processed comments for a dataset."""
    if not payload.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    
    comments_repo = CommentsRepository() 
    count = comments_repo.count(filters={"dataset_id": payload.dataset_id})
    return count

@router.post("/datasets/included-words", response_model=dict)
def get_included_words_endpoint(payload: DatasetIdRequest):
    """Retrieve included words for a dataset."""
    if not payload.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")

    words = words_repo.find(
        filters={"dataset_id": payload.dataset_id, "status": "included"},
        columns=["token", "pos", "count_words", "count_docs", "tfidf_min", "tfidf_max"]
    )
    return {"words": words}


@router.post("/datasets/removed-words", response_model=dict)
def get_removed_words_endpoint(payload: DatasetIdRequest):
    """Retrieve removed words for a dataset."""
    if not payload.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")

    words = words_repo.find(
        filters={"dataset_id": payload.dataset_id, "status": "removed"},
        columns=["token", "pos", "count_words", "count_docs", "tfidf_min", "tfidf_max"]
    )

    return {"words": words}