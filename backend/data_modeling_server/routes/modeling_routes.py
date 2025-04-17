from fastapi import APIRouter, Depends, HTTPException, Path, Request

from controllers.modeling_controller import MODEL_FUNCTIONS, process_topic_modeling
from database.models_table import ModelsRepository
from headers.app_id import get_app_id
from models.modeling_models import MetadataRequest, ModelListRequest, TopicModelingRequest, UpdateMetadataRequest
from routes.websocket_routes import manager

router = APIRouter(dependencies=[Depends(get_app_id)])

models_repo = ModelsRepository()



@router.post("/model/{method}")
async def topic_model_endpoint(
    request: Request,
    method: str = Path(..., description="The topic modeling method to use"),
    request_body: TopicModelingRequest = None
):
    modeling_function = MODEL_FUNCTIONS.get(method)

    if not modeling_function:
        raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

    return await process_topic_modeling(request.headers.get("x-app-id"),request_body, manager, method, modeling_function)



@router.post("/metadata")
def get_metadata_for_model_endpoint(request: MetadataRequest):
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
def update_metadata_for_model_endpoint(request: UpdateMetadataRequest):
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
def delete_model_endpoint(request: MetadataRequest):
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
def get_models_endpoint(request: ModelListRequest):
    if not request.dataset_id or not request.workspace_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    models_result = models_repo.find({"dataset_id": request.dataset_id})
    return models_result