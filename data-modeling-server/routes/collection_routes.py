import asyncio
from datetime import datetime
import os

import shutil
from typing import Dict
from uuid import uuid4
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, Form, Body
from controllers.collection_controller import create_dataset, delete_dataset, filter_posts_by_deleted, get_reddit_data_from_torrent, get_reddit_post_by_id, get_reddit_post_titles, get_reddit_posts_by_batch, list_datasets, parse_reddit_files, stream_upload_file, upload_dataset_file
from headers.app_id import get_app_id
from models.collection_models import FilterRedditPostsByDeleted, ParseDatasetRequest, ParseRedditFromTorrentFilesRequest, ParseRedditFromTorrentRequest, ParseRedditPostByIdRequest, ParseRedditPostsRequest
from constants import DATASETS_DIR
from services.transmission_service import GlobalTransmissionDaemonManager, get_transmission_manager
from routes.websocket_routes import manager

router = APIRouter(dependencies=[Depends(get_app_id)])


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
    request: Request,
    request_body: ParseRedditFromTorrentRequest,
    transmission_manager: GlobalTransmissionDaemonManager = Depends(get_transmission_manager)
):
    app_id = request.headers.get("x-app-id")

    async with transmission_manager:
        await manager.send_message(app_id, f"Starting download for subreddit '{request_body.subreddit}' ...")

        print(request_body.start_date, request_body.end_date)
        start_date = datetime.strptime(request_body.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(request_body.end_date, "%Y-%m-%d")

        start_month = start_date.strftime("%Y-%m")
        end_month = end_date.strftime("%Y-%m")

        try:
            await manager.send_message(
                app_id,
                f"Fetching torrent data for months {start_month} through {end_month}..."
            )

            output_files = await get_reddit_data_from_torrent(
                request_body.subreddit, 
                start_month, 
                end_month, 
                request_body.submissions_only,
                manager=manager,              
                app_id=app_id               
            )

            print(output_files)
            await manager.send_message(app_id, f"Finished downloading {len(output_files)} file(s).")

            new_folder_name = f"academic-torrent-{request_body.subreddit}"
            target_folder = os.path.join(DATASETS_DIR, new_folder_name)
            if not os.path.exists(target_folder):
                os.makedirs(target_folder)
                print(f"Created folder: {target_folder}")
                await manager.send_message(app_id, f"Created dataset folder: {target_folder}")

            for file_path in output_files:
                if os.path.exists(file_path):
                    file_name = os.path.basename(file_path)
                    link_path = os.path.join(target_folder, file_name)
                    if os.path.lexists(link_path):
                        os.remove(link_path)
                    os.symlink(os.path.abspath(file_path), link_path)
                    print(f"Created symlink: {link_path} -> {os.path.abspath(file_path)}")
                    await manager.send_message(
                        app_id,
                        f"Symlink created: {link_path} -> {os.path.abspath(file_path)}"
                    )
                else:
                    print(f"File not found: {file_path}")
                    await manager.send_message(
                        app_id,
                        f"WARNING: File not found on disk, skipping symlink: {file_path}"
                    )

            dataset_id = request_body.dataset_id
            if not dataset_id:
                dataset_id = str(uuid4())

            await manager.send_message(app_id, f"Parsing files into dataset {dataset_id}...")

            parse_reddit_files(dataset_id, target_folder, date_filter={"start_date": start_date, "end_date": end_date})

            await manager.send_message(app_id, "Parsing complete. All steps finished.")

        except Exception as e:
            err_msg = f"ERROR: {str(e)}"
            await manager.send_message(app_id, err_msg)
            raise HTTPException(status_code=500, detail=err_msg)

    return {"message": "Reddit data downloaded from torrent."}
    

@router.get("/get-torrent-data")
async def get_torrent_data_endpoint():
    datasets_directory = os.path.join(os.path.curdir, DATASETS_DIR)
    downloaded_torrent_list = list(filter(lambda x: x.startswith("academic-torrent"), os.listdir(datasets_directory)))
    datasets = list(map(lambda x: x[17:] ,downloaded_torrent_list))
    print(datasets)
    dataset_intervals: Dict[str, Dict[str, Dict[str, list[str]]]] = {}
    for dataset_folder_name in downloaded_torrent_list:
        dataset_name = dataset_folder_name[17:]
        all_files = list(filter(lambda x: x.startswith("RC") or x.startswith("RS"),os.listdir(os.path.join(datasets_directory, dataset_folder_name))))
        print(all_files)
        dataset_intervals[dataset_name] = {}
        dataset_intervals[dataset_name]["posts"] = {}
        dataset_intervals[dataset_name]["comments"] = {}
        for name in all_files:
            year = name[3:7]
            month = name[8:10]
            print(year, month)
            type = "posts" if name.startswith("RS") else "comments"
            try:
                dataset_intervals[dataset_name][type][year].append(month)
            except:
                dataset_intervals[dataset_name][type][year] = [month]
    return dataset_intervals

@router.post("/prepare-torrent-data-from-files")
async def prepare_torrent_data_from_files(
    request: ParseRedditFromTorrentFilesRequest
):
    folder_name = f"academic-torrent-{request.subreddit}"
    target_folder = os.path.join(DATASETS_DIR, folder_name)
    if not os.path.exists(target_folder):
        raise HTTPException(
            status_code=404, 
            detail=f"Folder '{folder_name}' not found in datasets."
        )

    valid_files = []
    for file_identifier in request.files:
        if file_identifier.startswith("RS_") or file_identifier.startswith("RC_"):
            prefix = file_identifier[:2]
            month_part = file_identifier[3:] 
        else:
            continue

        # Search the torrent folder for files that match the prefix and contain the month part.
        for f in os.listdir(target_folder):
            if f.startswith(prefix) and month_part in f and f.endswith(".json"):
                valid_files.append(os.path.join(target_folder, f))

    if not valid_files:
        raise HTTPException(
            status_code=404,
            detail="No matching files found in the torrent folder."
        )

    dataset_id = request.dataset_id
    if not dataset_id:
        dataset_id = str(uuid4())

    prepared_folder = os.path.join(DATASETS_DIR, f"prepared-torrent-{request.subreddit}-{dataset_id}")
    os.makedirs(prepared_folder, exist_ok=True)

    for file_path in valid_files:
        if os.path.exists(file_path):
            file_name = os.path.basename(file_path)
            link_path = os.path.join(prepared_folder, file_name)
            if os.path.lexists(link_path):
                os.remove(link_path)
            os.symlink(os.path.abspath(file_path), link_path)
            print(f"Created symlink: {link_path} -> {os.path.abspath(file_path)}")
        else:
            print(f"File not found: {file_path}")

    parse_reddit_files(dataset_id, prepared_folder, date_filter=None)

    shutil.rmtree(prepared_folder)
    print(f"Removed prepared folder: {prepared_folder}")

    return {"message": "Torrent files prepared and parsed.", "dataset_id": dataset_id}