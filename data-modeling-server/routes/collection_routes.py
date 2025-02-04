from fastapi import APIRouter, File, UploadFile, Form, Body
from controllers.collection_controller import create_dataset, delete_dataset, get_reddit_post_by_id, get_reddit_post_titles, get_reddit_posts_by_batch, list_datasets, parse_reddit_files, stream_upload_file, upload_dataset_file
from models.collection_models import ParseDatasetRequest, ParseRedditPostByIdRequest, ParseRedditPostsRequest


router = APIRouter()


@router.post("/datasets")
async def upload_dataset_endpoint(file: UploadFile = File(...), description: str = Form(None), dataset_id: str = Form(None), workspace_id: str = Form(...)):
    """Upload a dataset file and save metadata."""
    if not dataset_id:
        dataset_id = create_dataset(description, dataset_id, workspace_id)
    file_path = await upload_dataset_file(file, dataset_id)
    return {"message": f"File uploaded successfully", "dataset_id": dataset_id, "file_path": file_path}

@router.get("/datasets")
async def get_datasets_endpoint():
    """List all datasets."""
    return list_datasets()

@router.delete("/datasets/{dataset_id}")
async def remove_dataset_endpoint(dataset_id: str):
    """Delete a dataset."""
    return delete_dataset(dataset_id)


@router.post("/parse-reddit-dataset")
async def parse_reddit_dataset_endpoint(request: ParseDatasetRequest = Body(...)):
    """Parse a Reddit dataset from uploaded JSON files."""
    dataset_id = request.dataset_id
    return parse_reddit_files(dataset_id)


@router.post("/reddit-posts-by-batch")
async def get_reddit_posts_endpoint(request: ParseRedditPostsRequest = Body(...)):
    """Fetch Reddit posts from a dataset with pagination."""
    dataset_id = request.dataset_id
    batch = request.batch
    offset = request.offset
    all = request.all
    posts = get_reddit_posts_by_batch(dataset_id, batch, offset, all)
    return {post["id"]: post for post in posts}

@router.post("/reddit-posts-titles")
async def get_reddit_titles_endpoint(request: ParseRedditPostsRequest = Body(...)):
    """Get Reddit post titles for a dataset."""
    dataset_id = request.dataset_id
    return get_reddit_post_titles(dataset_id)

@router.post("/reddit-post-by-id")
async def get_reddit_post_endpoint(request: ParseRedditPostByIdRequest = Body(...)):
    """Fetch a Reddit post along with its comments."""
    dataset_id = request.datasetId
    post_id = request.postId
    return get_reddit_post_by_id(dataset_id, post_id)


@router.post("/stream-upload")
async def stream_upload_endpoint(file: UploadFile = File(...)):
    """Stream upload a file in chunks."""
    return await stream_upload_file(file)