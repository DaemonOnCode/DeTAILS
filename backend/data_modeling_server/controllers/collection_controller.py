import asyncio
import csv
import ctypes
from datetime import datetime
import errno
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import time
from typing import Any, Dict, List, Optional
from uuid import uuid4
from aiofiles import open as async_open
import aiofiles
from fastapi import HTTPException, UploadFile
from transmission_rpc import Client, Torrent, File as TorrentFile
from dateutil.relativedelta import relativedelta

import config
from constants import DATASETS_DIR, PATHS, UPLOAD_DIR
from database import DatasetsRepository, CommentsRepository, PostsRepository, PipelineStepsRepository, FileStatusRepository, TorrentDownloadProgressRepository, SelectedPostIdsRepository
from decorators.execution_time_logger import log_execution_time
from ipc import send_ipc_message
from models import Dataset, Comment, Post
from models.table_dataclasses import FileStatus
from routes.websocket_routes import ConnectionManager
from utils.coding_helpers import generate_transcript



dataset_repo = DatasetsRepository()
comment_repo = CommentsRepository()
post_repo = PostsRepository()
pipeline_repo = PipelineStepsRepository()
file_repo = FileStatusRepository()
progress_repo = TorrentDownloadProgressRepository()
selected_post_ids_repo = SelectedPostIdsRepository()


def get_current_download_dir():
    with open(PATHS["settings"], "r") as f:
        settings = json.load(f)
        # print(settings)
        if settings["transmission"]["downloadDir"] == "" :
            settings["transmission"]["downloadDir"] = PATHS["transmission"]
            with open(PATHS["settings"], "w") as f:
                json.dump(settings, f, indent=4)
        return settings["transmission"]["downloadDir"]


def normalize_file_key(file_key: str, current_download_dir: str = None) -> str:
    # If the file_key is an absolute path that starts with TRANSMISSION_DOWNLOAD_DIR,
    # convert it to a relative path; otherwise, return the key unchanged.
    if current_download_dir is None:
        TRANSMISSION_DOWNLOAD_DIR_ABS = get_current_download_dir()
    else:
        TRANSMISSION_DOWNLOAD_DIR_ABS = current_download_dir
    if file_key.startswith(TRANSMISSION_DOWNLOAD_DIR_ABS):
        return Path(os.path.relpath(file_key, TRANSMISSION_DOWNLOAD_DIR_ABS)).as_posix()
    return file_key


def get_file_key_full(msg: str, pattern: str, group_index: int = 2, current_download_dir: str = None) -> str:
    m = re.search(pattern, msg, re.IGNORECASE)
    if m:
        key = m.group(group_index).strip()
        if key.endswith("..."):
            key = key[:-3].strip()
        return normalize_file_key(key, current_download_dir)
    return None

def update_run_progress(run_id: str, new_message: str, current_download_dir: str = None):
    DOWNLOAD_DIR = current_download_dir or get_current_download_dir()
    print("download dir", DOWNLOAD_DIR)

    try:
        progress = progress_repo.get_progress(run_id)
    except Exception as e:
        print(f"Error getting progress for run {run_id}: {e}")
        return
    messages = json.loads(progress.messages) if progress.messages else []
    messages.append(new_message)
    workspace_updates = {"messages": json.dumps(messages)}
    if re.search(r"(Parsing complete|All steps finished)", new_message):
        workspace_updates["status"] = "complete"
        workspace_updates["progress"] = 100.0
    progress_repo.update_progress(run_id, workspace_updates)

    if "Metadata progress:" in new_message:
        m = re.search(r"Metadata progress:\s+([\d.]+)", new_message)
        if m:
            percent = float(m.group(1))
            step_data = pipeline_repo.get_step_progress(run_id, "Metadata")
            step_messages = json.loads(step_data.messages) if step_data.messages else []
            step_messages.append(new_message)
            new_progress = max(getattr(step_data, "progress", 0), percent)
            pipeline_repo.update_step_progress(
                run_id, "Metadata",
                {"messages": json.dumps(step_messages), "status": "in-progress", "progress": new_progress}
            )
    elif "Metadata download complete" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Metadata")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Metadata",
            {"messages": json.dumps(step_messages), "status": "complete", "progress": 100.0}
        )

    if "Verification in progress:" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Verification")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Verification",
            {"messages": json.dumps(step_messages), "status": "in-progress", "progress": 50.0}
        )
    elif "Torrent verified" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Verification")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Verification",
            {"messages": json.dumps(step_messages), "status": "complete", "progress": 100.0}
        )

    if "Finished downloading" in new_message or "All wanted files have been processed" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Downloading")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Downloading",
            {"messages": json.dumps(step_messages), "status": "complete", "progress": 100.0}
        )
    elif ("downloading file" in new_message.lower()) or ("file has been fully downloaded" in new_message.lower()):
        step_data = pipeline_repo.get_step_progress(run_id, "Downloading")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        current_progress = getattr(step_data, "progress", 0)
        new_progress = float(max(current_progress, 50))
        pipeline_repo.update_step_progress(
            run_id, "Downloading",
            {"messages": json.dumps(step_messages), "status": "in-progress", "progress": new_progress}
        )

    if "Symlink created:" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Symlinks")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        if step_data.status == "idle":
            pipeline_repo.update_step_progress(
                run_id, "Symlinks",
                {"messages": json.dumps(step_messages), "status": "in-progress", "progress": 50.0}
            )
        else:
            pipeline_repo.update_step_progress(
                run_id, "Symlinks",
                {"messages": json.dumps(step_messages)}
            )
    if "Parsing files into dataset" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Symlinks")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Symlinks",
            {"messages": json.dumps(step_messages), "status": "complete", "progress": 100.0}
        )

    if "Parsing files into dataset" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Parsing")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Parsing",
            {"messages": json.dumps(step_messages), "status": "in-progress", "progress": 30.0}
        )
    if "Parsing complete" in new_message or "All steps finished" in new_message:
        step_data = pipeline_repo.get_step_progress(run_id, "Parsing")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Parsing",
            {"messages": json.dumps(step_messages), "status": "complete", "progress": 100.0}
        )

    if "error" in new_message.lower():
        for step in ["Metadata", "Verification", "Downloading", "Symlinks", "Parsing"]:
            step_data = pipeline_repo.get_step_progress(run_id, step)
            if step_data.status in ["idle", "in-progress"]:
                step_messages = json.loads(step_data.messages) if step_data.messages else []
                step_messages.append(new_message)
                pipeline_repo.update_step_progress(
                    run_id, step,
                    {"messages": json.dumps(step_messages), "status": "error"}
                )
                break

    if "processing file:" in new_message.lower() or "processed file:" in new_message.lower():
        key = get_file_key_full(new_message, r"(Processing|Processed)\s+file:\s+(.*?)(?:\s|\(|\.\.\.|$)", current_download_dir=DOWNLOAD_DIR)
        if key:
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(run_id, key, {"messages": json.dumps(file_messages)})

    if "downloading" in new_message.lower() and "%" in new_message:
        key = get_file_key_full(new_message, r"Downloading\s+(.*?):\s+([\d.]+)%\s+\((\d+)/(\d+)\s+bytes\)", group_index=1, current_download_dir=DOWNLOAD_DIR)
        if key:
            m = re.search(r"Downloading\s+(.*?):\s+([\d.]+)%\s+\((\d+)/(\d+)\s+bytes\)", new_message, re.IGNORECASE)
            percent = float(m.group(2))
            completed = int(m.group(3))
            total = int(m.group(4))
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "in-progress",
                 "progress": percent, "completed_bytes": completed, "total_bytes": total}
            )

    if "fully downloaded" in new_message.lower():
        key = get_file_key_full(new_message, r"File\s+(.*)\s+fully downloaded.*\((\d+)/(\d+)\s+bytes\)", group_index=1, current_download_dir=DOWNLOAD_DIR)
        if key:
            m = re.search(r"File\s+(.*)\s+fully downloaded.*\((\d+)/(\d+)\s+bytes\)", new_message, re.IGNORECASE)
            completed = int(m.group(2))
            total = int(m.group(3))
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "complete",
                 "progress": 100.0, "completed_bytes": completed, "total_bytes": total}
            )

    if "Extracting" in new_message:
        key = get_file_key_full(new_message, r"Extracting.*from\s+(.*?\.zst)(?:\.{3})?", group_index=1, current_download_dir=DOWNLOAD_DIR)
        if key:
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(run_id, key, {"messages": json.dumps(file_messages), "status": "extracting"})

    if "JSON extracted:" in new_message:
        m = re.search(r"JSON extracted:\s+(.*)/(R[S|C]_[\d-]+)\.json", new_message, re.IGNORECASE)
        if m:
            dir_part = m.group(1).strip() 
            rel_dir = os.path.relpath(dir_part, DOWNLOAD_DIR)
            key = os.path.join(rel_dir, m.group(2) + ".zst")
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "complete", "progress": 100.0}
            )
    if "Processed data saved to monthly JSON files for" in new_message:
        m = re.search(r"Processed data saved to monthly JSON files for\s+(.*)", new_message)
        if m:
            file_key = m.group(1).strip() 
            rel_dir =  Path(os.path.relpath(file_key, DOWNLOAD_DIR)).as_posix()
            key = Path(os.path.join(rel_dir, file_key)).as_posix()
            file_data = file_repo.get_file_progress(run_id, rel_dir)
            print("This is the file data", file_data)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "complete", "progress": 100.0}
            )

    if "No data found" in new_message:
        m = re.search(r"No data found for\s+.+?\s+in file\s+(.+?)\.", new_message, re.IGNORECASE)
        if m:
            key =  m.group(1)+".zst"
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "empty", "progress": 100.0}
            )

    if "Files already downloaded" in new_message:
        m = re.search(r"Files already downloaded:\s*(.*)", new_message)
        if m:
            file_list_str = m.group(1).strip()
            if file_list_str:
                files_already_downloaded = [f.strip() for f in file_list_str.split(",")]
            else:
                files_already_downloaded = []
            progress_repo.update_progress(
                run_id,
                {"files_already_downloaded": json.dumps(files_already_downloaded)}
            )

    if "error downloading" in new_message.lower():
        key = get_file_key_full(new_message, r"ERROR downloading\s+(.*?):", group_index=1, current_download_dir=DOWNLOAD_DIR)
        if key:
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "error"}
            )

    
def delete_run(run_id: str):
    progress_repo.delete_progress_for_run(run_id)
    pipeline_repo.delete_steps_for_run(run_id)
    file_repo.delete_files_for_run(run_id)
    print(f"Run {run_id} deleted successfully.")

def create_dataset(description: str, workspace_id: str = None):
    workspace_id = workspace_id or str(uuid4())
    dataset_repo.insert(Dataset(id=workspace_id, name="", description=description, workspace_id=workspace_id))
    return workspace_id

def list_datasets():
    return dataset_repo.find()

def update_dataset(workspace_id: str, **kwargs):
    dataset_repo.update({"id": workspace_id}, kwargs)
    return {"message": "Dataset updated successfully"}

def delete_dataset(workspace_id: str):
    dataset_repo.delete({"id": workspace_id})
    return {"message": "Dataset deleted successfully"}

def get_reddit_posts_by_batch(
    workspace_id: str,
    batch: int,
    offset: int,
    all: bool = False,
    search_term: str = "",
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
    hide_removed: bool = False,
    page: int = 1,
    items_per_page: int = 10,
    get_all_ids: bool = False
):
    params = [workspace_id]

    if hide_removed:
        base_query = """
        FROM posts p
        WHERE p.workspace_id = ?
        AND (
            (p.title    NOT IN ('[removed]','[deleted]')
            AND p.selftext NOT IN ('[removed]','[deleted]'))
            OR
            EXISTS (
            SELECT 1
            FROM comments c
            WHERE c.workspace_id = p.workspace_id
                AND c.post_id    = p.id
            )
        )
        """
    else:
        base_query = """
        FROM posts p
        WHERE p.workspace_id = ?
        """

    if search_term:
        base_query += " AND (p.title LIKE ? OR p.selftext LIKE ? OR p.url LIKE ?)"
        wildcard = f"%{search_term}%"
        params.extend([wildcard, wildcard, wildcard])

    if start_time:
        base_query += " AND p.created_utc >= ?"
        params.append(start_time)
    if end_time:
        base_query += " AND p.created_utc <= ?"
        params.append(end_time)

    metadata_query = f"""
    SELECT
      p.subreddit,
      MIN(p.created_utc) AS start_ts,
      MAX(p.created_utc) AS end_ts
    {base_query}
    GROUP BY p.subreddit
    """
    meta_rows = post_repo.execute_raw_query(metadata_query, params, keys=True)
    if meta_rows:
        meta_row = meta_rows[0]
        metadata = {
            "subreddit":  meta_row["subreddit"],
            "start_date": datetime.fromtimestamp(meta_row["start_ts"]).strftime('%Y-%m-%d'),
            "end_date":   datetime.fromtimestamp(meta_row["end_ts"]).strftime('%Y-%m-%d'),
        }
    else:
        metadata = {
            "subreddit":  None,
            "start_date": None,
            "end_date":   None,
        }

    summary_query = f"""
    SELECT
      COUNT(*)         AS total_count,
      MIN(created_utc) AS start_ts,
      MAX(created_utc) AS end_ts
    FROM (
        SELECT p.created_utc
        {base_query}
    ) AS summary_subq
    """
    print("Summary query:", summary_query, params)
    total_count, start_ts, end_ts = post_repo.execute_raw_query(summary_query, params).fetchone()
    start_date = datetime.fromtimestamp(start_ts).strftime('%Y-%m-%d') if start_ts else None
    end_date   = datetime.fromtimestamp(end_ts).strftime('%Y-%m-%d')   if end_ts   else None

    if get_all_ids:
        id_query = f"SELECT p.id {base_query}"
        rows = post_repo.execute_raw_query(id_query, params, keys=True)
        return {
            "post_ids":    [r["id"] for r in rows]
        }

    select_clause = "SELECT p.id, p.title, p.selftext, p.url, p.created_utc"
    if not all:
        offset_val = (page - 1) * items_per_page
        paging_clause = " ORDER BY p.created_utc ASC LIMIT ? OFFSET ?"
        params.extend([items_per_page, offset_val])
    else:
        paging_clause = " ORDER BY p.created_utc ASC"

    final_query = f"{select_clause} {base_query}{paging_clause}"
    rows = post_repo.execute_raw_query(final_query, params, keys=True)
    posts = {r["id"]: r for r in rows}

    return {
        "metadata":    metadata,
        "posts":       posts,
        "total_count": total_count,
        "start_date":  start_date,
        "end_date":    end_date
    }

def get_reddit_post_titles(workspace_id: str):
    return post_repo.find({"workspace_id": workspace_id}, columns=["id", "title"])

def count_comments(comments):
    total = len(comments)
    for comment in comments:
        total += count_comments(comment.get("comments", []))
    return total

def get_reddit_post_by_id(workspace_id: str, post_id: str, columns: list = None):
    # comment_repo.index_comments()
    post = post_repo.find(
        {"workspace_id": workspace_id, "id": post_id}, 
        columns=columns,
        map_to_model=not columns
    )
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = get_comments_recursive(post_id, workspace_id)
    return {**post[0], "comments": comments}

@log_execution_time()
def get_comments_recursive(post_id: str, workspace_id: str):

    comments = comment_repo.get_comments_by_post_optimized(workspace_id, post_id)
    # print("Comments fetched:", comments)

    comment_map = {comment["id"]: comment for comment in comments}

    for comment in comments:
        parent_id = comment.get("parent_id")

        if parent_id and parent_id in comment_map:
            parent = comment_map[parent_id]
            parent.setdefault("comments", []).append(comment)

    return [comment for comment in comments if comment["parent_id"] is None or comment["parent_id"] == post_id]


async def upload_dataset_file(file: UploadFile, workspace_id: str) -> str:
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are allowed.")
    
    file_path = f"{DATASETS_DIR}/{workspace_id}/{file.filename}"
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    async with async_open(file_path, "wb") as f:
        await f.write(await file.read())

    return file_path

async def stream_upload_file(file: UploadFile) -> dict:
    filename = f"{uuid4().hex}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    async with async_open(file_path, "wb") as out_file:
        while chunk := await file.read(1024 * 1024): 
            await out_file.write(chunk)

    return {"message": f"File {file.filename} uploaded successfully.", "path": file_path}


def omit_first_if_matches_structure(data: list) -> list:
    if data and isinstance(data[0], dict) and "id" not in data[0]:
        return data[1:]
    return data


def parse_reddit_files(workspace_id: str, dataset_path: str = None, date_filter: dict[str, datetime] = None, is_primary: bool = False) -> dict:
    existing_posts_count = post_repo.count({"workspace_id": workspace_id})
    if existing_posts_count > 0:
        post_repo.delete({"workspace_id": workspace_id})

    existing_comments_count = comment_repo.count({"workspace_id": workspace_id})
    if existing_comments_count > 0:
        comment_repo.delete({"workspace_id": workspace_id})

    dataset_path = dataset_path or os.path.join(DATASETS_DIR, workspace_id)
    
    all_files = []
    try:
        files = os.listdir(dataset_path)
        print("Files in dataset directory:", files, dataset_path)
    except FileNotFoundError:
        print(f"Directory not found: {dataset_path}")
        return {"error": f"Directory not found: {dataset_path}"}
    except NotADirectoryError:
        print(f"Not a directory: {dataset_path}")
        return {"error": f"Not a directory: {dataset_path}"}
    except PermissionError:
        print(f"Permission denied: {dataset_path}")
        return {"error": f"Permission denied: {dataset_path}"}
    except Exception as e:
        print(f"Unexpected error listing directory {dataset_path}: {e}")
        return {"error": f"Unexpected error: {e}"}
    
    for f in files:
        if f.endswith(".json"):
            full_path = os.path.join(dataset_path, f)
            if f.startswith("RS_") or f.startswith("RC_"):
                parts = f.split('_')
                if len(parts) >= 2:
                    date_str = parts[1].split('.')[0] 
                    try:
                        file_date = datetime.strptime(date_str, "%Y-%m")
                        month_start = file_date.replace(day=1)
                        month_end = (month_start + relativedelta(months=1)) - relativedelta(days=1)
                        month_start_ts = month_start.timestamp()
                        month_end_ts = month_end.timestamp()

                        if date_filter:
                            start_ts = date_filter.get("start_date").timestamp() if date_filter.get("start_date") else None
                            end_ts = date_filter.get("end_date").timestamp() if date_filter.get("end_date") else None
                            if (start_ts and month_end_ts < start_ts) or (end_ts and month_start_ts > end_ts):
                                continue
                        file_type = "submissions" if f.startswith("RS_") else "comments"
                        all_files.append({"type": file_type, "path": full_path})
                    except ValueError:
                        print(f"Invalid date in filename: {f}")
                        continue
            elif f.endswith("_submissions.json"):
                all_files.append({"type": "submissions", "path": full_path})
            elif f.endswith("_comments.json"):
                all_files.append({"type": "comments", "path": full_path})

    start_ts = end_ts = None
    if date_filter:
        start_date = date_filter.get("start_date")
        end_date = date_filter.get("end_date")
        if start_date:
            start_ts = start_date.timestamp()
        if end_date:
            end_ts = end_date.timestamp()

    subreddit = ""
    for file in all_files:
        try:
            with open(file["path"], "r", encoding="utf-8") as f:
                raw_data_str = f.read()
        except FileNotFoundError:
            print(f"File not found: {file['path']}")
            raise e
        except PermissionError:
            print(f"Permission denied: {file['path']}")
            raise e
        except IOError as e:
            print(f"IO error reading file {file['path']}: {e}")
            raise e
        except Exception as e:
            print(f"Unexpected error reading file {file['path']}: {e}")
            raise e
        try:
            raw_data = json.loads(raw_data_str, strict=False)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON in file {file['path']}: {e}")
            continue

        filtered_data = omit_first_if_matches_structure(raw_data)

        if file["type"] == "submissions":
            posts = []
            for p in filtered_data:
                try:
                    created = float(p.get("created_utc", 0))
                except (ValueError, TypeError):
                    created = 0.0

                if date_filter:
                    if (start_ts and created < start_ts) or (end_ts and created > end_ts):
                        continue
                subreddit = p.get("subreddit", subreddit)
                posts.append(Post(
                    id=p["id"],
                    over_18=p.get("over_18", 0),
                    subreddit=p.get("subreddit", ""),
                    score=p.get("score", 0),
                    thumbnail=p.get("thumbnail", ""),
                    permalink=p.get("permalink", ""),
                    is_self=p.get("is_self", 0),
                    domain=p.get("domain", ""),
                    created_utc=int(created),
                    url=p.get("url", ""),
                    num_comments=p.get("num_comments", 0),
                    title=p.get("title", ""),
                    selftext=p.get("selftext", ""),
                    author=p.get("author", ""),
                    hide_score=p.get("hide_score", 0),
                    subreddit_id=p.get("subreddit_id", ""),
                    workspace_id=workspace_id
                ))
            post_repo.insert_batch(posts)

        elif file["type"] == "comments":
            comments = []
            for c in filtered_data:
                try:
                    created = float(c.get("created_utc", 0))
                except (ValueError, TypeError):
                    created = 0.0

                if date_filter:
                    if (start_ts and created < start_ts) or (end_ts and created > end_ts):
                        continue

                subreddit = c.get("subreddit", "unknown")

                link_id_str = str(c.get("link_id", ""))
                parent_id_str = str(c.get("parent_id", ""))

                post_id = link_id_str.split("_")[1] if "_" in link_id_str else None
                link_id = link_id_str.split("_")[1] if "_" in link_id_str else None
                parent_id = parent_id_str.split("_")[1] if "_" in parent_id_str else None

                if not c.get("id", ""):
                    print(f"Skipping comment without id: {c}")
                    continue
                if not workspace_id:
                    print(f"Skipping comment without workspace_id: {c}")
                    continue
                if not post_id:
                    print(f"Skipping comment with invalid post_id: {c}")
                    continue
                if not parent_id:
                    print(f"Skipping comment with invalid parent_id: {c}")
                    continue

                comments.append(Comment(
                    id=c.get("id", ""),
                    body=c.get("body", ""),
                    author=c.get("author", ""),
                    post_id=post_id,
                    created_utc= int(created),
                    link_id=link_id,
                    parent_id=parent_id,
                    controversiality=c.get("controversiality", 0),
                    score_hidden=c.get("score_hidden", False),
                    score=c.get("score", 0),
                    subreddit_id=c.get("subreddit_id", ""),
                    retrieved_on=c.get("retrieved_on", 0),
                    gilded=c.get("gilded", 0),
                    workspace_id=workspace_id 
                ))
            seen = set()
            unique_comments = []
            for comment in comments:
                key = (comment.id, comment.workspace_id, comment.post_id, comment.parent_id)
                if key not in seen:
                    seen.add(key)
                    unique_comments.append(comment)
                else:
                    print(f"Skipping duplicate comment with key: {key}")
            comment_repo.insert_batch(unique_comments)
    update_dataset(workspace_id, name=subreddit)

    return {"message": "Reddit dataset parsed successfully"}


async def run_command_async(command: str) -> str:
    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        print("Command failed with return code:", process.returncode)
        error_message = stderr.decode().strip()
        print("Error output:", error_message)
        if "No such file or directory" in error_message:
            raise FileNotFoundError(error_message)
        elif "Permission denied" in error_message:
            raise PermissionError(error_message)
        elif "Out of memory" in error_message:
            raise MemoryError(error_message)
        elif "No space left on device" in error_message:
            raise OSError(errno.ENOSPC, os.strerror(errno.ENOSPC))
        elif "Input/output error" in error_message:
            raise OSError(errno.EIO, os.strerror(errno.EIO))
        elif "Broken pipe" in error_message:
            raise OSError(errno.EPIPE, os.strerror(errno.EPIPE))
        else:
            raise RuntimeError(f"Torrent failed to extract data, try fallback torrent.")
    else:
        print("Command executed successfully.")
    return stdout.decode()


async def run_command_and_stream(command):
    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        limit=1024 * 1024 * 512 # 512 MB buffer size
    )
    buffer = bytearray()
    try:
        while True:
            chunk = await process.stdout.read(65536)
            if not chunk:
                if buffer:
                    yield buffer.decode('utf-8', errors='ignore').strip()
                break
            buffer.extend(chunk)
            
            while True:
                newline_idx = buffer.find(b'\n')
                if newline_idx == -1:
                    break
                line = buffer[:newline_idx].decode('utf-8', errors='ignore').strip()
                buffer = buffer[newline_idx + 1:]
                if line: 
                    yield line
    except Exception as e:
        print(f"Error reading stream: {e}")
        raise
    finally:
        await process.wait()

async def process_reddit_data(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    subreddit: str,
    zst_filename: str,
    is_primary: bool = False,
    current_download_dir: str = None
) -> list[str]:
    directory = os.path.dirname(zst_filename)
    intermediate_filename = f"output_{time.time()}.jsonl"
    intermediate_file = os.path.join(directory, intermediate_filename)
    print(f"Intermediate file: {intermediate_file}")

    zstd_executable = PATHS["executables"]["zstd"]

    if is_primary:
        command = f'"{zstd_executable}" -cdq --memory=2048MB -T8 "{zst_filename}"'
    else:
        ripgrep_executable = PATHS["executables"]["ripgrep"]
        regex = r'(?s)\{.*?"subreddit":\s*"' + subreddit + r'".*?\}'
        if os.name == 'nt':
            regex_escaped = regex.replace('"', '\\"')
            command = (
                f'"{zstd_executable}" -cdq --memory=2048MB -T8 "{zst_filename}" ^| '
                f'"{ripgrep_executable}" -P "{regex_escaped}" > "{intermediate_file}" || exit /B 0'
            )
        else:
            command = (
                f'"{zstd_executable}" -cdq --memory=2048MB -T8 "{zst_filename}" | '
                f'"{ripgrep_executable}" -P \'{regex}\' > "{intermediate_file}" || true'
            )

    print(f"Running command:\n{command}")
    message = f"Extracting data from {zst_filename}..."
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=current_download_dir)

    if is_primary:
        print("Primary magnet link processed.")

        if "_submissions.zst" in zst_filename:
            data_type = "S"
        elif "_comments.zst" in zst_filename:
            data_type = "C"
        else:
            raise ValueError(f"Cannot determine data type from filename: {zst_filename}")
        
        data_type = "S" if "_submissions.zst" in zst_filename else "C" if "_comments.zst" in zst_filename else None
        if not data_type:
            raise ValueError(f"Cannot determine data type from filename: {zst_filename}")

        monthly_files = {}
        async for line in run_command_and_stream(command):
            try:
                obj = json.loads(line)
                created_utc = obj.get("created_utc")
                if created_utc:
                    dt = datetime.fromtimestamp(float(created_utc))
                    key = f"{dt.year}-{dt.month:02d}"
                    if key not in monthly_files:
                        monthly_filename = os.path.join(directory, f"R{data_type}_{key}.jsonl")
                        monthly_files[key] = await aiofiles.open(monthly_filename, "w", encoding="utf-8")
                        await send_ipc_message(app_id, f"Creating monthly file: {monthly_filename}")
                    await monthly_files[key].write(line + "\n")
            except json.JSONDecodeError:
                print("Skipping invalid JSON line.")
        for key, file in monthly_files.items():
            print(f"Closing monthly file: R{data_type}_{key}.jsonl")
            await file.close()

        json_files = []
        for key in monthly_files:
            jsonl_filename = os.path.join(directory, f"R{data_type}_{key}.jsonl")
            json_filename = os.path.join(directory, f"R{data_type}_{key}.json")
            message = f"Converting {jsonl_filename} to {json_filename}"
            print(message)
            await send_ipc_message(app_id, message)
            async with aiofiles.open(jsonl_filename, "r", encoding="utf-8") as jsonl_file, \
                    aiofiles.open(json_filename, "w", encoding="utf-8") as json_file:
                await json_file.write("[\n")
                first = True
                async for line in jsonl_file:
                    if not first:
                        await json_file.write(",\n")
                    await json_file.write(line.strip())
                    first = False
                await json_file.write("\n]")
            json_files.append(json_filename)
            os.remove(jsonl_filename) 

        message = f"Processed data saved to monthly JSON files for {zst_filename}"
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=current_download_dir)

        return json_files

    else:
        await run_command_async(command)

        print(f"Fallback magnet link processed for subreddit '{subreddit}'.")
        base = os.path.splitext(os.path.basename(zst_filename))[0]
        output_filename = os.path.join(directory, f"{base}.json")

        print(f"Opening intermediate file for reading: {intermediate_file}")
        print(f"Opening output file for writing: {output_filename}")
        async with aiofiles.open(intermediate_file, "r", encoding="utf-8") as infile, \
                   aiofiles.open(output_filename, "w", encoding="utf-8") as outfile:
            await outfile.write("[\n")
            first = True
            async for line in infile:
                try:
                    obj = json.loads(line.strip())
                    if obj.get("subreddit") == subreddit:
                        if not first:
                            await outfile.write(",\n")
                        await outfile.write(json.dumps(obj, ensure_ascii=False))
                        first = False
                except json.JSONDecodeError:
                    print("Skipping invalid JSON line.")
            await outfile.write("\n]")

        print(f"Processed data saved to {output_filename}")
        message = f"JSON extracted: {output_filename}"
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=current_download_dir)

        try:
            print(f"Removing intermediate file: {intermediate_file}")
            os.remove(intermediate_file)
            print(f"Intermediate file {intermediate_filename} removed.")
        except Exception as e:
            print(f"Warning: Could not remove intermediate file {intermediate_filename}: {e}")

        return [output_filename]

def wait_for_file_stable(file_path, stable_time=5, poll_interval=2) -> bool:
    if not os.path.exists(file_path):
        return False
    last_size = os.path.getsize(file_path)
    stable_counter = 0
    while stable_counter < stable_time:
        time.sleep(poll_interval)
        new_size = os.path.getsize(file_path)
        if new_size == last_size:
            stable_counter += poll_interval
        else:
            stable_counter = 0
            last_size = new_size
    return True


def generate_month_range(start_month: str, end_month: str):
    start = datetime.strptime(start_month, "%Y-%m")
    end = datetime.strptime(end_month, "%Y-%m")
    next_month = end.month % 12 + 1
    next_year = end.year + (1 if next_month == 1 else 0)
    end_exclusive = datetime(next_year, next_month, 1)
    
    wanted_range = []
    while start < end_exclusive:
        wanted_range.append(start.strftime("%Y-%m"))
        next_month = start.month % 12 + 1
        next_year = start.year + (1 if next_month == 1 else 0)
        start = datetime(next_year, next_month, 1)
    return wanted_range


async def wait_for_metadata(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    c: Client,
    torrent: Torrent,
    current_download_dir: str = None
) -> Torrent:
    c.start_torrent(torrent.id)

    while True:
        torrent = c.get_torrent(torrent.id)
        mpc = getattr(torrent, "metadata_percent_complete", None)
        if mpc is None:
            print("Metadata percent not available yet, waiting...")
            await asyncio.sleep(1)
            continue

        print(f"Metadata progress: {mpc * 100:.2f}%")
        await send_ipc_message(app_id, f"Metadata progress: {mpc * 100:.2f}%")
        update_run_progress(run_id, f"Metadata progress: {mpc * 100:.2f}%", current_download_dir=current_download_dir)

        if mpc >= 1.0:
            break

        await asyncio.sleep(1)

    message = "Metadata download complete. Verifying metadata..."
    print(message)
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=current_download_dir)

    timeout_seconds = 15
    check_interval = 1
    t0 = time.time()
    while True:
        torrent = c.get_torrent(torrent.id)
        torrent_files = torrent.get_files()
        if torrent_files:
            print(f"Torrent has {len(torrent_files)} files.")
            break
        if (time.time() - t0) > timeout_seconds:
            print("Still no files after 15s. Something is off, but continuing.")
            break
        await asyncio.sleep(check_interval)

    message = "Metadata fully loaded. Stopping torrent."
    print(message)
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=current_download_dir)

    c.stop_torrent(torrent.id)
    return torrent


async def verify_torrent_with_retry(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    c: Client, 
    torrent: Torrent, 
    torrent_url: str, 
    download_dir: str,
) -> Torrent:
    c.verify_torrent(torrent.id)
    while True:
        torrent = c.get_torrent(torrent.id)
        status = torrent.status
        print(f"Torrent status: {status}")
        if hasattr(torrent, "error") and torrent.error != 0:
            message = f"Verification error: {torrent.error_string}. Re-adding torrent..."
            print(message)
            c.remove_torrent(torrent.id)
            print("Removed torrent. Re-adding...")
            await asyncio.sleep(10)
            torrent = c.add_torrent(torrent_url, download_dir=download_dir)
            print("Torrent re-added.")
            while True:
                try:
                    torrent = c.get_torrent(torrent.id)
                    if torrent.status not in ["stopped", "check pending", "checking"]:
                        break
                except Exception as e:
                    print(f"Waiting for torrent to be recognized: {e}")
                await asyncio.sleep(5)

            torrent = await wait_for_metadata(manager, app_id, run_id, c, torrent)
            c.verify_torrent(torrent.id)
            print("Re-verifying torrent.")
            await asyncio.sleep(10)
            continue
        if status not in ["check pending", "checking"]:
            print("Torrent status is not 'check pending' or 'checking' - breaking.", status)
            break
        message = f"Verification in progress: {status}"
        print(message)
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)
        await asyncio.sleep(5)
    message = "Torrent verified. Starting download."
    print(message)
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=download_dir)
    return torrent


def get_files_to_process(torrent_files: list[TorrentFile], wanted_range: list, submissions_only: bool) -> list[str]:
    files_to_process = []
    for file in torrent_files:
        print(file.name, file.name.split("_")[1], file.name.split("_")[1] in wanted_range)
        filename = os.path.splitext(os.path.basename(file.name))[0]
        print(filename)
        if submissions_only and not filename.startswith("RS"):
            continue
        if filename.split("_")[1] in wanted_range:
            print(f"Adding file {file.name} to the list.")
            files_to_process.append(file.name)
    return files_to_process

async def process_single_file(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    c: Client, 
    torrent: Torrent, 
    file_name: str, 
    download_dir: str, 
    subreddit: str,
    is_primary: bool = True
):
    print(f"\n--- Processing file: {file_name} ---")

    message = f"Processing file: {file_name} ..."
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=download_dir)

    torrent_files = c.get_torrent(torrent.id).get_files()

    wanted_file = next((f for f in torrent_files if f.name == file_name), None)
    if not wanted_file:
        raise ValueError(f"File {file_name} not found in torrent.")

    file_id = wanted_file.id
    print(f"Setting file {file_name} as wanted, others as unwanted {file_id}")
    all_file_ids = [f.id for f in torrent_files]
    other_ids = [fid for fid in all_file_ids if fid != file_id]
    c.change_torrent(torrent.id, files_wanted=[file_id], files_unwanted=other_ids)

    c.start_torrent(torrent.id)
    print(f"Downloading file {file_name}...")

    file_path = os.path.join(download_dir, file_name)
    file_path_zst = file_path if file_path.endswith('.zst') else file_path + '.zst'

    academic_file_paths = []
    try:
        while True:
            curr_torrent = c.get_torrent(torrent.id)
            if hasattr(curr_torrent, "error") and curr_torrent.error != 0:
                err_msg = f"Error downloading {file_name}: {curr_torrent.error_string}"
                print(err_msg)
                await send_ipc_message(app_id, err_msg)
                update_run_progress(run_id, err_msg)
                if "Out of memory" in err_msg:
                    raise MemoryError(err_msg)
                elif "No space left on device" in err_msg:
                    raise OSError(errno.ENOSPC, os.strerror(errno.ENOSPC))
                elif "Input/output error" in err_msg:
                    raise OSError(errno.EIO, os.strerror(errno.EIO))
                elif "Broken pipe" in err_msg:
                    raise OSError(errno.EPIPE, os.strerror(errno.EPIPE))
                else:
                    raise RuntimeError(f"Torrent download failed: {err_msg}")
            
            file_status = next((f for f in curr_torrent.get_files() if f.id == file_id), None)
            if file_status and file_status.completed >= file_status.size:
                print(f"File {file_name} has been fully downloaded.")
                message = f"File {file_name} fully downloaded ({file_status.completed}/{file_status.size} bytes)."
                print(message)
                await send_ipc_message(app_id, message)
                update_run_progress(run_id, message, current_download_dir=download_dir)
                break
            else:
                if file_status and file_status.size != 0:
                    pct_done = (file_status.completed / file_status.size) * 100
                    message = f"Downloading {file_name}: {pct_done:.2f}% ({file_status.completed}/{file_status.size} bytes)"
                    print(message)
                    await send_ipc_message(app_id, message)
                    update_run_progress(run_id, message, current_download_dir=download_dir)
                else:
                    print(f"Waiting for file {file_name} to start...")
                await asyncio.sleep(5)

        check_start = time.time()
        while not os.path.exists(file_path_zst):
            if time.time() - check_start > 2 *60:
                print(f"File {file_path_zst} not found after 120 seconds.")
                await send_ipc_message(app_id, f"ERROR: File {file_path_zst} not found after 120 seconds. Try retrying the request.")
                raise FileNotFoundError(f"File {file_path_zst} not found after 120 seconds. Try retrying the request.")
            message = f"Waiting for file {file_path_zst} to appear on disk..."
            print(message)
            await send_ipc_message(app_id, message)
            update_run_progress(run_id, message, current_download_dir=download_dir)
            await asyncio.sleep(5)
        
        output_files = await process_reddit_data(manager, app_id, run_id, subreddit, file_path_zst, is_primary, download_dir)

        parent_dir = os.path.dirname(os.path.dirname(file_path_zst))
        academic_folder_name = f"academic-torrent-{subreddit}"
        academic_folder = os.path.join(parent_dir, academic_folder_name)
        if not os.path.exists(academic_folder):
            os.makedirs(academic_folder, exist_ok=True)
            msg = f"Created academic folder: {academic_folder}"
            print(msg)
            await send_ipc_message(app_id, msg)
            update_run_progress(run_id, msg)

        datasets_academic_folder = os.path.join(DATASETS_DIR, academic_folder_name)
        os.makedirs(datasets_academic_folder, exist_ok=True)

        if os.name == 'nt':  
            symlink_commands = []
            for output_file in output_files:
                academic_file_path = os.path.join(academic_folder, os.path.basename(output_file))
                shutil.move(output_file, academic_file_path)
                msg = f"Moved file: {output_file} -> {academic_file_path}"
                print(msg)
                await send_ipc_message(app_id, msg)
                update_run_progress(run_id, msg)
                
                symlink_path = os.path.join(datasets_academic_folder, os.path.basename(output_file))
                if os.path.lexists(symlink_path):
                    os.remove(symlink_path)
                symlink_commands.append(f'mklink "{symlink_path}" "{academic_file_path}"')
                academic_file_paths.append(academic_file_path)
            
            if symlink_commands:
                # Alert the user about the need for administrator access
                message = "Administrator access is required to create symbolic links on Windows. A UAC prompt will appear to grant these permissions."
                await send_ipc_message(app_id, message)
                update_run_progress(run_id, message, current_download_dir=download_dir)
                
                # Create and execute a batch file with all mklink commands
                with tempfile.NamedTemporaryFile(mode='w', suffix='.bat', delete=False) as bat_file:
                    bat_file.write("\n".join(symlink_commands))
                    bat_file_path = bat_file.name
                
                shell32 = ctypes.windll.shell32
                result = shell32.ShellExecuteW(None, "runas", "cmd.exe", f'/c "{bat_file_path}"', None, 1)
                if result <= 32:  # ShellExecuteW returns <= 32 on failure
                    os.unlink(bat_file_path)
                    error_msg = f"Failed to create symlinks: Administrator access was not granted (ShellExecute returned {result})."
                    await send_ipc_message(app_id, error_msg)
                    raise RuntimeError(error_msg)
                
                await asyncio.sleep(2)  # Brief wait for the batch file to execute
                os.unlink(bat_file_path)  # Clean up the temporary file
                
                message = f"Created {len(symlink_commands)} symlinks in {datasets_academic_folder}"
                await send_ipc_message(app_id, message)
                update_run_progress(run_id, message, current_download_dir=download_dir)
        else: 
            for output_file in output_files:
                academic_file_path = os.path.join(academic_folder, os.path.basename(output_file))
                shutil.move(output_file, academic_file_path)
                msg = f"Moved file: {output_file} -> {academic_file_path}"
                print(msg)
                await send_ipc_message(app_id, msg)
                update_run_progress(run_id, msg)
                
                symlink_path = os.path.join(datasets_academic_folder, os.path.basename(output_file))
                if os.path.lexists(symlink_path):
                    os.remove(symlink_path)
                os.symlink(academic_file_path, symlink_path)
                message = f"Symlink created: {symlink_path} -> {academic_file_path}"
                await send_ipc_message(app_id, message)
                update_run_progress(run_id, message, current_download_dir=download_dir)
                academic_file_paths.append(academic_file_path)

        for academic_file_path in academic_file_paths:
            if os.stat(academic_file_path).st_size <= 5:
                message = f"No data found in {os.path.basename(academic_file_path)} for {subreddit}."
                await send_ipc_message(app_id, message)
                update_run_progress(run_id, message, current_download_dir=download_dir)

        message = f"Processed file: {file_name} into {len(academic_file_paths)} files."
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)
        print(f"Processing complete for file {file_name}.")

    except Exception as e:
        print(f"Error processing file {file_name}: {e}")
        message = f"Error processing file {file_name}: {e}"
        await send_ipc_message(app_id, message)
        # update_run_progress(run_id, message, current_download_dir=download_dir)
        raise e
    finally:
        c.stop_torrent(torrent.id)
        if os.path.exists(file_path_zst):
            print(f"Removing file {file_path_zst}")
            os.remove(file_path_zst)

    await asyncio.sleep(1)
    return academic_file_paths

async def get_reddit_data_from_torrent(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    workspace_id: str,
    subreddit: str,
    start_month: str = "2005-06",
    end_month: str = "2023-12",
    submissions_only: bool = True,
    use_fallback: bool = False,
    download_dir: str = None,
):
    settings = config.CustomSettings()
    if not download_dir:
        TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR = get_current_download_dir()
    else:
        TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR = download_dir
    print(f"Transmission download dir: {TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR}")
    
    PRIMARY_MAGNET_LINK = settings.transmission.magnetLink
    FALLBACK_MAGNET_LINK = settings.transmission.fallbackMagnetLink
    
    c = Client(host="localhost", port=9091, username="transmission", password="password")

    academic_folder_name = f"academic-torrent-{subreddit}"
    parent_dir = os.path.dirname(TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)
    academic_folder = os.path.join(parent_dir, academic_folder_name)
    if not os.path.exists(academic_folder):
        os.makedirs(academic_folder, exist_ok=True)

    if not use_fallback:
        torrent_hash_string = PRIMARY_MAGNET_LINK.split("btih:")[1].split("&")[0]
        magnet_link = PRIMARY_MAGNET_LINK
        message = f"Using primary torrent for subreddit '{subreddit}'."
    else:
        torrent_hash_string = FALLBACK_MAGNET_LINK.split("btih:")[1].split("&")[0]
        magnet_link = FALLBACK_MAGNET_LINK
        message = f"Using fallback torrent with range {start_month} to {end_month}."

    torrents = c.get_torrents()
    current_torrent = next((t for t in torrents if t.hashString == torrent_hash_string), None)
    if not current_torrent:
        current_torrent = c.add_torrent(magnet_link, download_dir=TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)
        message += " (Added new torrent)"
    else:
        message += " (Using existing torrent)"
    
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=download_dir)

    if current_torrent.download_dir != TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR:
        message = f"Torrent download directory mismatch. Moving torrent to {TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR}..."
        print(message)
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)
        c.move_torrent_data(current_torrent.id, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)
        await asyncio.sleep(10)  
        current_torrent = await verify_torrent_with_retry(manager, app_id, run_id, c, current_torrent, magnet_link, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)
        await asyncio.sleep(10)  
        current_torrent = c.get_torrent(torrent_hash_string)
        message = f"Torrent data moved and verified in {TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR}."
        print(message)
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)

    torrent_to_use = await wait_for_metadata(manager, app_id, run_id, c, current_torrent, current_download_dir=download_dir)
    
    if not use_fallback:
        files_to_process = get_files_to_process_primary(torrent_to_use.get_files(), subreddit, submissions_only)
    else:
        wanted_range = generate_month_range(start_month, end_month)
        files_to_process = get_files_to_process_fallback(torrent_to_use.get_files(), wanted_range, submissions_only)

    files_to_process_actually = []
    files_already_processed = []
    for zst_file in files_to_process:
        base = os.path.splitext(os.path.basename(zst_file))[0]
        json_file = os.path.join(academic_folder, f"{base}.json")
        if os.path.exists(json_file):
            files_already_processed.append(zst_file)
        else:
            files_to_process_actually.append(zst_file)

    if files_already_processed:
        already_processed_names = [os.path.splitext(os.path.basename(f))[0] for f in files_already_processed]
        message = f"Files already downloaded: {', '.join(already_processed_names)}"
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)
    
    message = f"Files to process: {len(files_to_process_actually)}"
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=download_dir)

    file_repo.insert_batch(
        list(map(lambda f: FileStatus(run_id=run_id, file_name=f, workspace_id=workspace_id), files_to_process_actually))
    )

    torrent_to_use = await verify_torrent_with_retry(manager, app_id, run_id, c, torrent_to_use, magnet_link, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)

    all_output_files = []
    for file in files_to_process_actually:
        output_files = await process_single_file(manager, app_id, run_id, c, torrent_to_use, file, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR, subreddit, not use_fallback)
        all_output_files.extend(output_files)
        
    
    message = f"All wanted files have been processed. Total new files: {len(all_output_files)}."
    print(message)
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=download_dir)
    return all_output_files


def filter_posts_by_deleted(workspace_id: str):
    return post_repo.get_filtered_post_ids(workspace_id)


def get_all_torrent_data():
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

    return dataset_intervals

def get_torrent_files_by_subreddit(subreddit: str):
    datasets_directory = DATASETS_DIR
    dir_path = os.path.join(datasets_directory, f"academic-torrent-{subreddit}")
    if not os.path.exists(dir_path):
        return []
    valid_files = [
        os.path.splitext(f)[0]
        for f in os.listdir(dir_path)
        if (not os.path.islink(os.path.join(dir_path, f))) or os.path.exists(os.path.join(dir_path, f))
    ]
    return valid_files


def get_files_to_process_primary(torrent_files: list[TorrentFile], subreddit: str, submissions_only: bool) -> list[str]:
    files_to_process = []
    for file in torrent_files:
        basename = os.path.basename(file.name)
        if basename == f"{subreddit}_submissions.zst" and submissions_only:
            files_to_process.append(file.name)
        elif not submissions_only and (basename == f"{subreddit}_comments.zst" or basename == f"{subreddit}_submissions.zst"):
            files_to_process.append(file.name)
    return files_to_process

def get_files_to_process_fallback(torrent_files: list[TorrentFile], wanted_range: list, submissions_only: bool) -> list[str]:
    """Select files from the fallback (monthly-based) torrent."""
    files_to_process = []
    for file in torrent_files:
        filename = os.path.splitext(os.path.basename(file.name))[0]
        if submissions_only and not filename.startswith("RS"):
            continue
        if "RC_" in file.name or "RS_" in file.name:
            month_part = filename.split("_")[1]
            if month_part in wanted_range:
                files_to_process.append(file.name)
    return files_to_process


async def check_primary_torrent(
    workspace_id: str,
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    subreddit: str,
    submissions_only: bool,
    download_dir: str = None,
):
    if not download_dir:
        TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR = get_current_download_dir()
    else:
        TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR = download_dir
    c = Client(host="localhost", port=9091, username="transmission", password="password")

    PRIMARY_MAGNET_LINK = config.CustomSettings().transmission.magnetLink
    primary_hash = PRIMARY_MAGNET_LINK.split("btih:")[1].split("&")[0]
    torrents = c.get_torrents()
    primary_torrent = next((t for t in torrents if t.hashString == primary_hash), None)
    if not primary_torrent:
        primary_torrent = c.add_torrent(PRIMARY_MAGNET_LINK, download_dir=TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)

    message = f"Checking primary torrent for subreddit '{subreddit}'..."
    await send_ipc_message(app_id, message)
    update_run_progress(run_id, message, current_download_dir=download_dir)

    primary_torrent = await wait_for_metadata(manager, app_id, run_id, c, primary_torrent)
    primary_files = get_files_to_process_primary(primary_torrent.get_files(), subreddit, submissions_only)

    file_sizes = [file.size for file in primary_torrent.get_files() if file.name in primary_files]
    total_size = sum(file_sizes)

    download_dir = TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR
    available_space = shutil.disk_usage(download_dir).free

    if total_size > available_space:
        message = f"Insufficient disk space for subreddit '{subreddit}'. Required: {total_size} bytes, Available: {available_space} bytes."
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)
        return {"status": False, "files": primary_files, "error": "Insufficient disk space"}

    if len(primary_files) > 0:
        message = f"Found subreddit '{subreddit}' in primary torrent. Files available: {len(primary_files)}, Total size: {total_size} bytes"
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)
        return {"status": True, "files": primary_files, "total_size": total_size}
    else:
        message = f"Subreddit '{subreddit}' not found in primary torrent."
        await send_ipc_message(app_id, message)
        update_run_progress(run_id, message, current_download_dir=download_dir)
        return {"status": False, "files": [], "total_size": 0, "error": "Subreddit not found"}
    

async def get_post_transcripts_csv(workspace_id: str, post_ids: List[str], csv_file: str) -> None:
    sem = asyncio.Semaphore(os.cpu_count())
    transcripts = [None] * len(post_ids) 
    next_index = 0
    write_lock = asyncio.Lock()

    async def fetch_post_transcript(post_id: str, index: int) -> None:
        async with sem:
            try:
                post = await asyncio.to_thread(get_reddit_post_by_id, workspace_id, post_id, ["id", "title", "selftext"])
                transcript = await anext(generate_transcript(post))
            except HTTPException as e:
                print(f"Post {post_id} not found: {e.detail}")
                transcript = ""
            except Exception as e:
                print(f"Unexpected error for post {post_id}: {e}")
                transcript = ""
            transcripts[index] = transcript 
            await write_consecutive()

    async def write_consecutive():
        nonlocal next_index
        async with write_lock:
            while next_index < len(post_ids) and transcripts[next_index] is not None:
                writer.writerow({"Post ID": post_ids[next_index], "Transcript": transcripts[next_index]})
                next_index += 1

    with open(csv_file, "w", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=["Post ID", "Transcript"])
        writer.writeheader()

        tasks = [fetch_post_transcript(post_id, i) for i, post_id in enumerate(post_ids)]
        await asyncio.gather(*tasks) 

    return csv_file



def get_post_and_comments_from_id(post_id: str, workspace_id: str) -> Dict[str, Any]:
    posts_repo = PostsRepository()
    comments_repo = CommentsRepository()

    post = posts_repo.find_one({"id": post_id, "workspace_id": workspace_id}, columns=["id", "title", "selftext"], map_to_model=False)

    comments = comments_repo.find({"post_id": post_id, "workspace_id": workspace_id}, columns=["id", "body", "parent_id", "author"], map_to_model=False)

    comment_map = {comment["id"]: comment for comment in comments}

    for comment in comments:
        if comment["parent_id"] and comment["parent_id"] in comment_map:
            parent = comment_map[comment["parent_id"]]
            parent.setdefault("comments", []).append(comment)

    top_level_comments = [comment for comment in comments if comment["parent_id"] == post_id]
    
    return {**post, "comments": top_level_comments}