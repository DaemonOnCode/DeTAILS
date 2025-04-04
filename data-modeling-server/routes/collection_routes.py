import asyncio
import calendar
from datetime import datetime
import os

import shutil
from typing import Dict
from uuid import uuid4
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, Form, Body
from controllers.collection_controller import check_primary_torrent, create_dataset, delete_dataset, delete_run, filter_posts_by_deleted, get_reddit_data_from_torrent, get_reddit_post_by_id, get_reddit_post_titles, get_reddit_posts_by_batch, list_datasets, parse_reddit_files, stream_upload_file, update_run_progress, upload_dataset_file
from database import PipelineStepsRepository, TorrentDownloadProgressRepository
from database.state_dump_table import StateDumpsRepository
from headers.app_id import get_app_id
from models.collection_models import FilterRedditPostsByDeleted, GetTorrentStatusRequest, ParseDatasetRequest, ParseRedditFromTorrentFilesRequest, ParseRedditFromTorrentRequest, ParseRedditPostByIdRequest, ParseRedditPostsRequest
from constants import DATASETS_DIR, STUDY_DATABASE_PATH
from models import PipelineStep, TorrentDownloadProgress
from services.transmission_service import GlobalTransmissionDaemonManager, get_transmission_manager
from routes.websocket_routes import manager

router = APIRouter(dependencies=[Depends(get_app_id)])

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

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
    results = await asyncio.to_thread(get_reddit_posts_by_batch,
        request.dataset_id,
        request.batch,
        request.offset,
        request.all,
        request.search_term,
        request.start_time,
        request.end_time,
        request.hide_removed,
        request.page,
        request.items_per_page,
        request.get_all_ids
    )
    return results

@router.post("/reddit-posts-titles")
async def get_reddit_titles_endpoint(request: ParseRedditPostsRequest = Body(...)):
    dataset_id = request.dataset_id
    return get_reddit_post_titles(dataset_id)

@router.post("/reddit-post-by-id")
async def get_reddit_post_endpoint(request: ParseRedditPostByIdRequest = Body(...)):
    dataset_id = request.datasetId
    post_id = request.postId
    return await asyncio.to_thread(get_reddit_post_by_id, dataset_id, post_id)


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
    # print(filtered_ids)
    return filtered_ids

progress_repo = TorrentDownloadProgressRepository()

pipeline_repo = PipelineStepsRepository()

@router.post("/download-reddit-data-from-torrent")
async def download_reddit_from_torrent_endpoint(
    request: Request,
    request_body: ParseRedditFromTorrentRequest,
    transmission_manager: GlobalTransmissionDaemonManager = Depends(get_transmission_manager)
):
    async with transmission_manager:
        app_id = request.headers.get("x-app-id")

        run_id = str(uuid4())

        progress_repo.insert(TorrentDownloadProgress(
            workspace_id=request_body.workspace_id,
            dataset_id=request_body.dataset_id,
            run_id=run_id,
            status="in-progress",
            subreddit=request_body.subreddit,
            start_month=request_body.start_date,
            end_month=request_body.end_date
        ))

        pipeline_repo.insert_batch(
            list(map(
                lambda step: PipelineStep(
                    workspace_id=request_body.workspace_id,
                    dataset_id=request_body.dataset_id,
                    run_id=run_id,
                    step_label=step
                ), ["Metadata", "Verification", "Downloading", "Symlinks", "Parsing"]
            ))
        )
        message = f"Starting download for subreddit '{request_body.subreddit}' ..."
        await manager.send_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=request_body.download_dir)

        print(request_body.start_date, request_body.end_date)
        start_date = datetime.strptime(request_body.start_date, "%Y-%m")
        end_date = datetime.strptime(request_body.end_date, "%Y-%m")
        start_month = start_date.strftime("%Y-%m")
        end_month = end_date.strftime("%Y-%m")
        start_date = start_date.replace(day=1)
        last_day = calendar.monthrange(end_date.year, end_date.month)[1]
        end_date = end_date.replace(day=last_day)


        try:
            message = f"Fetching torrent data for months {start_month} through {end_month}..."
            await manager.send_message(app_id, message)
            update_run_progress(run_id, message, current_download_dir=request_body.download_dir)

            output_files = await get_reddit_data_from_torrent(
                manager, app_id, run_id,
                request_body.dataset_id, request_body.workspace_id,
                request_body.subreddit, 
                start_month, 
                end_month, 
                request_body.submissions_only,
                request_body.use_fallback,
                request_body.download_dir
            )

            message = f"Finished downloading {len(output_files)} file(s)."
            await manager.send_message(app_id, message)
            update_run_progress(run_id, message, current_download_dir=request_body.download_dir)

            academic_folder = None
            academic_folder_name = f"academic-torrent-{request_body.subreddit}"

            datasets_academic_folder = os.path.join(DATASETS_DIR, academic_folder_name)
            print("Datasets academic folder:", datasets_academic_folder)
            if not os.path.exists(datasets_academic_folder):
                os.makedirs(datasets_academic_folder)
                message = f"Created datasets folder: {datasets_academic_folder}"
                await manager.send_message(app_id, message)
                update_run_progress(run_id, message, current_download_dir=request_body.download_dir)
            print("Output files:", output_files)
            if len(output_files) > 0:
                downloaded_dir = os.path.dirname(output_files[0])
                parent_dir = os.path.dirname(downloaded_dir)
                academic_folder = os.path.join(parent_dir, academic_folder_name)
                if not os.path.exists(academic_folder):
                    os.makedirs(academic_folder, exist_ok=True)
                    message = f"Created folder: {academic_folder}"
                    await manager.send_message(app_id, message)
                    update_run_progress(run_id, message, current_download_dir=request_body.download_dir)
                    
            print("Academic folder:", academic_folder)
            if not academic_folder:
                academic_folder = os.path.join(DATASETS_DIR, f"academic-torrent-{request_body.subreddit}")
                os.makedirs(academic_folder, exist_ok=True)
            dataset_id = request_body.dataset_id
            if not dataset_id:
                dataset_id = str(uuid4())

            message = f"Parsing files into dataset {dataset_id}..."
            await manager.send_message(app_id, message)
            update_run_progress(run_id, message, current_download_dir=request_body.download_dir)

            print("Parsing files in academic folder:", academic_folder)
            if os.path.exists(academic_folder or ""):
                await asyncio.to_thread(
                    parse_reddit_files,
                    dataset_id, academic_folder, date_filter={"start_date": start_date, "end_date": end_date}, is_primary = not request_body.use_fallback
                )

            print("Finished parsing files.")
            message = "Parsing complete. All steps finished."
            await manager.send_message(app_id, message)
            update_run_progress(run_id, message, current_download_dir=request_body.download_dir)



            message = "Loading dataset, this may take a few moments..."
            await manager.send_message(app_id, message)
            update_run_progress(run_id, message, current_download_dir=request_body.download_dir)

        except Exception as e:
            err_msg = f"ERROR: {str(e)}"
            await manager.send_message(app_id, err_msg)
            # update_run_progress(run_id, err_msg)
            print(err_msg)
            raise e
        finally:
            delete_run(run_id)

    return {"message": "Reddit data downloaded from torrent."}
    

@router.get("/get-torrent-data")
async def get_torrent_data_endpoint():
    datasets_directory = DATASETS_DIR
    downloaded_torrent_list = [
        d for d in os.listdir(datasets_directory)
        if d.startswith("academic-torrent")
    ]

    dataset_intervals: Dict[str, Dict[str, Dict[str, list[str]]]] = {}

    for dataset_folder_name in downloaded_torrent_list:
        folder_path = os.path.join(datasets_directory, dataset_folder_name)
        dataset_name = dataset_folder_name[17:]

        all_files = [
            f for f in os.listdir(folder_path)
            if f.startswith("RC") or f.startswith("RS")
        ]

        broken_files = []

        for f in all_files:
            file_path = os.path.join(folder_path, f)
            if os.path.islink(file_path):
                target_path = os.readlink(file_path)
                target_abs = os.path.join(folder_path, target_path)
                if not os.path.exists(target_abs):
                    print(f"Broken symlink detected: {file_path} -> {target_abs}")
                    os.remove(file_path)
                    broken_files.append(f)
                    continue

        all_files = [f for f in all_files if f not in broken_files]
        print(f"Found {len(all_files)} valid files in folder: {folder_path}")

        dataset_intervals[dataset_name] = {"posts": {}, "comments": {}}
        for name in all_files:
            year = name[3:7]
            month = name[8:10]
            doc_type = "posts" if name.startswith("RS") else "comments"

            try:
                dataset_intervals[dataset_name][doc_type][year].append(month)
            except KeyError:
                dataset_intervals[dataset_name][doc_type][year] = [month]

    datasets_to_remove = []
    for dataset in dataset_intervals:
        if not dataset_intervals[dataset]["posts"].keys() and \
           not dataset_intervals[dataset]["comments"].keys():
            datasets_to_remove.append(dataset)
    
    for dataset in datasets_to_remove:
        del dataset_intervals[dataset]

    for dataset, types in dataset_intervals.items():
        for doc_type in types:
            for year, months in types[doc_type].items():
                months.sort(key=int)

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
                try:
                    os.remove(link_path)
                except Exception as e:
                    print(f"Error removing existing symlink: {link_path}", e)
            os.symlink(os.path.abspath(file_path), link_path)
            print(f"Created symlink: {link_path} -> {os.path.abspath(file_path)}")
        else:
            print(f"File not found: {file_path}")

    parse_reddit_files(dataset_id, prepared_folder, date_filter=None)

    shutil.rmtree(prepared_folder, ignore_errors=True)
    print(f"Removed prepared folder: {prepared_folder}")

    return {"message": "Torrent files prepared and parsed.", "dataset_id": dataset_id}

@router.post("/torrent-status")
async def get_torrent_status_endpoint(
    request: Request,
    request_body: GetTorrentStatusRequest
):
    return progress_repo.get_current_status(request_body.workspace_id, request_body.dataset_id)

@router.post("/check-reddit-torrent-availability")
async def check_reddit_torrent_availability(
    request: Request,
    request_body: ParseRedditFromTorrentRequest,
    transmission_manager: GlobalTransmissionDaemonManager = Depends(get_transmission_manager)
):
    async with transmission_manager:
        app_id = request.headers.get("x-app-id")
        run_id = str(uuid4())

        result = await check_primary_torrent(
            manager, app_id, run_id, request_body.subreddit, request_body.submissions_only, request_body.download_dir
        )
        return result