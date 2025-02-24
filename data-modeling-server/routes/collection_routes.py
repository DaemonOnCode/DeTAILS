import asyncio
from datetime import datetime
import os

from uuid import uuid4
from fastapi import APIRouter, Depends, File, UploadFile, Form, Body
from controllers.collection_controller import create_dataset, delete_dataset, filter_posts_by_deleted, get_reddit_data_from_torrent, get_reddit_post_by_id, get_reddit_post_titles, get_reddit_posts_by_batch, list_datasets, parse_reddit_files, stream_upload_file, upload_dataset_file
from models.collection_models import FilterRedditPostsByDeleted, ParseDatasetRequest, ParseRedditFromTorrentRequest, ParseRedditPostByIdRequest, ParseRedditPostsRequest
from constants import DATASETS_DIR
from services.transmission_service import GlobalTransmissionDaemonManager, get_transmission_manager

router = APIRouter()


@router.post("/datasets")
async def upload_dataset_endpoint(file: UploadFile = File(...), description: str = Form(None), dataset_id: str = Form(None), workspace_id: str = Form(...)):
    if not dataset_id:
        dataset_id = create_dataset(description, dataset_id, workspace_id)
    file_path = await upload_dataset_file(file, dataset_id)
    return {"message": f"File uploaded successfully", "dataset_id": dataset_id, "file_path": file_path}

@router.get("/datasets")
async def get_datasets_endpoint():
    return list_datasets()

@router.delete("/datasets/{dataset_id}")
async def remove_dataset_endpoint(dataset_id: str):
    return delete_dataset(dataset_id)


@router.post("/parse-reddit-dataset")
async def parse_reddit_dataset_endpoint(request: ParseDatasetRequest = Body(...)):
    dataset_id = request.dataset_id
    return parse_reddit_files(dataset_id)


@router.post("/reddit-posts-by-batch")
async def get_reddit_posts_endpoint(request: ParseRedditPostsRequest = Body(...)):
    dataset_id = request.dataset_id
    batch = request.batch
    offset = request.offset
    all = request.all
    posts = get_reddit_posts_by_batch(dataset_id, batch, offset, all)
    return {post["id"]: post for post in posts}

@router.post("/reddit-posts-titles")
async def get_reddit_titles_endpoint(request: ParseRedditPostsRequest = Body(...)):
    dataset_id = request.dataset_id
    return get_reddit_post_titles(dataset_id)

@router.post("/reddit-post-by-id")
async def get_reddit_post_endpoint(request: ParseRedditPostByIdRequest = Body(...)):
    dataset_id = request.datasetId
    post_id = request.postId
    return get_reddit_post_by_id(dataset_id, post_id)


@router.post("/stream-upload")
async def stream_upload_endpoint(file: UploadFile = File(...)):
    return await stream_upload_file(file)

@router.post("/filter-posts-by-deleted")
async def filter_posts_by_deleted_endpoint(
    request: FilterRedditPostsByDeleted
):
    loop = asyncio.get_running_loop()
    filtered_ids = await loop.run_in_executor(None, filter_posts_by_deleted, request.dataset_id)
    # filtered_ids = filter_posts_by_deleted(request.dataset_id)
    print(filtered_ids)
    return filtered_ids


@router.post("/download-reddit-data-from-torrent")
async def download_reddit_from_torrent_endpoint(
    request: ParseRedditFromTorrentRequest,
    transmission_manager: GlobalTransmissionDaemonManager = Depends(get_transmission_manager)
):
    async with transmission_manager:
        print(request.start_date, request.end_date)
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d")

        start_month = start_date.strftime("%Y-%m")
        end_month = end_date.strftime("%Y-%m")
        output_files = await get_reddit_data_from_torrent(request.subreddit, start_month, end_month, request.submissions_only)
        print(output_files)

        new_folder_name = f"academic-torrent-{request.subreddit}"
        target_folder = os.path.join(DATASETS_DIR, new_folder_name)
        if not os.path.exists(target_folder):
            os.makedirs(target_folder)
            print(f"Created folder: {target_folder}")

        for file_path in output_files:
            if os.path.exists(file_path):
                file_name = os.path.basename(file_path)
                link_path = os.path.join(target_folder, file_name)
                if os.path.lexists(link_path):
                    os.remove(link_path)
                os.symlink(os.path.abspath(file_path), link_path)
                print(f"Created symlink: {link_path} -> {os.path.abspath(file_path)}")
            else:
                print(f"File not found: {file_path}")

        dataset_id = request.dataset_id
        if not dataset_id:
            dataset_id = str(uuid4())
        
        parse_reddit_files(dataset_id, target_folder, date_filter={"start_date": start_date, "end_date": end_date})

    return {"message": "Reddit data downloaded from torrent."}
    

@router.post("/get-torrent-data")
async def get_torrent_data_endpoint():
    pass