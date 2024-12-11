from typing import List
from fastapi import APIRouter, HTTPException
from services.token_filtering_service import token_filtering_service
from models import Rule

router = APIRouter(prefix="/api/filtering", tags=["Filtering"])


@router.get("/datasets")
def list_datasets():
    return token_filtering_service.list_datasets()


@router.get("/datasets/{dataset_id}/rules")
def get_rules(dataset_id: str):
    try:
        return token_filtering_service.get_filter_rules(dataset_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/datasets/{dataset_id}/rules")
def apply_rules(dataset_id: str, rules: List[Rule]):
    try:
        return token_filtering_service.apply_filter_rules(dataset_id, [rule.dict() for rule in rules])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/rules/save")
def save_rules(data: dict):
    return token_filtering_service.save_filter_rules(data)


@router.post("/rules/load")
def load_rules(data: dict):
    return token_filtering_service.load_filter_rules(data)
