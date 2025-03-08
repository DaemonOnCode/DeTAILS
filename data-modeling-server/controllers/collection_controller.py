import asyncio
from datetime import datetime
import json
import os
import re
import time
from uuid import uuid4
from aiofiles import open as async_open
from fastapi import HTTPException, UploadFile
from transmission_rpc import Client, Torrent, File as TorrentFile

from constants import ACADEMIC_TORRENT_MAGNET, DATASETS_DIR, PATHS, UPLOAD_DIR, TRANSMISSION_DOWNLOAD_DIR, get_app_data_path
from database import DatasetsRepository, CommentsRepository, PostsRepository, PipelineStepsRepository, FileStatusRepository, TorrentDownloadProgressRepository
from decorators.execution_time_logger import log_execution_time
from models import Dataset, Comment, Post, TorrentDownloadProgress
from models.table_dataclasses import FileStatus
from routes.websocket_routes import ConnectionManager



dataset_repo = DatasetsRepository()
comment_repo = CommentsRepository()
post_repo = PostsRepository()

# Database repository
dataset_repo = DatasetsRepository()

pipeline_repo = PipelineStepsRepository()
file_repo = FileStatusRepository()
progress_repo = TorrentDownloadProgressRepository()

TRANSMISSION_DOWNLOAD_DIR_ABS = PATHS["transmission"]

def normalize_file_key(file_key: str) -> str:
    """
    If the file_key is an absolute path that starts with TRANSMISSION_DOWNLOAD_DIR,
    convert it to a relative path; otherwise, return the key unchanged.
    """
    if file_key.startswith(TRANSMISSION_DOWNLOAD_DIR_ABS):
        return os.path.relpath(file_key, TRANSMISSION_DOWNLOAD_DIR_ABS)
    return file_key


def get_file_key_full(msg: str, pattern: str, group_index: int = 2) -> str:
    m = re.search(pattern, msg, re.IGNORECASE)
    if m:
        key = m.group(group_index).strip()
        if key.endswith("..."):
            key = key[:-3].strip()
        return normalize_file_key(key)
    return None

def update_run_progress(run_id: str, new_message: str):
    """
    Updates the run's progress based on the received message.
    Mirrors the logic of your TypeScript function, using full file keys for file-related updates.
    """
    # === Update Workspace Progress ===
    progress = progress_repo.get_progress(run_id)
    messages = json.loads(progress.messages) if progress.messages else []
    messages.append(new_message)
    workspace_updates = {"messages": json.dumps(messages)}
    if re.search(r"(Parsing complete|All steps finished)", new_message):
        workspace_updates["status"] = "complete"
        workspace_updates["progress"] = 100.0
    progress_repo.update_progress(run_id, workspace_updates)

    # === Update Pipeline Steps ===
    # -- METADATA --
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

    # -- VERIFICATION --
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

    # -- DOWNLOADING --
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

    # -- SYMLINKS --
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
        # Mark Symlinks as complete.
        step_data = pipeline_repo.get_step_progress(run_id, "Symlinks")
        step_messages = json.loads(step_data.messages) if step_data.messages else []
        step_messages.append(new_message)
        pipeline_repo.update_step_progress(
            run_id, "Symlinks",
            {"messages": json.dumps(step_messages), "status": "complete", "progress": 100.0}
        )

    # -- PARSING --
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

    # -- ERRORS --
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

    # -- Processing/Processed File --
    if "processing file:" in new_message.lower() or "processed file:" in new_message.lower():
        key = get_file_key_full(new_message, r"(Processing|Processed)\s+file:\s+(.*?)(?:\s|\(|\.\.\.|$)")
        if key:
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(run_id, key, {"messages": json.dumps(file_messages)})

    # -- Downloading File Progress --
    if "downloading" in new_message.lower() and "%" in new_message:
        key = get_file_key_full(new_message, r"Downloading\s+(.*?):\s+([\d.]+)%\s+\((\d+)/(\d+)\s+bytes\)", group_index=1)
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

    # -- Fully Downloaded File --
    if "fully downloaded" in new_message.lower():
        key = get_file_key_full(new_message, r"File\s+(.*)\s+fully downloaded.*\((\d+)/(\d+)\s+bytes\)", group_index=1)
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

    # -- Extracting File --
    if "Extracting" in new_message:
        key = get_file_key_full(new_message, r"Extracting.*from\s+(.*?\.zst)(?:\.{3})?", group_index=1)
        if key:
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(run_id, key, {"messages": json.dumps(file_messages), "status": "extracting"})

    # -- JSON Extracted --
    if "JSON extracted:" in new_message:
        m = re.search(r"JSON extracted:\s+(.*)/(RS_[\d-]+)\.json", new_message, re.IGNORECASE)
        if m:
            # Reconstruct the file key as inserted: the relative path should be the same as f.name.
            dir_part = m.group(1).strip()  # e.g. "/Volumes/Crucial X9/abc/transmission-downloads/reddit/submissions"
            # Get the relative directory by removing the download dir prefix:
            rel_dir = os.path.relpath(dir_part, PATHS["transmission"])
            key = os.path.join(rel_dir, m.group(2) + ".zst")
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "complete", "progress": 100.0}
            )

    # -- Error Downloading File --
    if "error downloading" in new_message.lower():
        key = get_file_key_full(new_message, r"ERROR downloading\s+(.*?):", group_index=1)
        if key:
            file_data = file_repo.get_file_progress(run_id, key)
            file_messages = json.loads(file_data.messages) if file_data.messages else []
            file_messages.append(new_message)
            file_repo.update_file_progress(
                run_id, key,
                {"messages": json.dumps(file_messages), "status": "error"}
            )

    
def delete_run(run_id: str):
    """
    Deletes all records associated with a run_id once it is completed.
    """
    progress_repo.delete_progress_for_run(run_id)
    pipeline_repo.delete_steps_for_run(run_id)
    file_repo.delete_files_for_run(run_id)
    print(f"Run {run_id} deleted successfully.")

def create_dataset(description: str, dataset_id: str = None, workspace_id: str = None):
    """Create a new dataset entry."""
    dataset_id = dataset_id or str(uuid4())
    dataset_repo.insert(Dataset(id=dataset_id, name="", description=description, workspace_id=workspace_id))
    return dataset_id

def list_datasets():
    return dataset_repo.find()

def update_dataset(dataset_id: str, **kwargs):
    dataset_repo.update({"id": dataset_id}, kwargs)
    return {"message": "Dataset updated successfully"}

def delete_dataset(dataset_id: str):
    dataset_repo.delete({"id": dataset_id})
    return {"message": "Dataset deleted successfully"}

def get_reddit_posts_by_batch(dataset_id: str, batch: int, offset: int, all: bool):
    if all:
        return post_repo.find({"dataset_id": dataset_id}, order_by={"column":"created_utc"})
    return post_repo.find({"dataset_id": dataset_id}, limit=batch, offset=offset, order_by={"column":"created_utc"})

def get_reddit_post_titles(dataset_id: str):
    return post_repo.find({"dataset_id": dataset_id}, columns=["id", "title"])

def get_reddit_post_by_id(dataset_id: str, post_id: str):
    post = post_repo.find({"dataset_id": dataset_id, "id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = get_comments_recursive(post_id, dataset_id)
    return {**post[0], "comments": comments}

@log_execution_time()
def get_comments_recursive(post_id: str, dataset_id: str):

    comments = comment_repo.get_comments_by_post_optimized(dataset_id, post_id)
    # comments = comment_repo.find({"post_id": post_id, "dataset_id": dataset_id}, map_to_model=False)

    comment_map = {comment["id"]: comment for comment in comments}

    for comment in comments:
        parent_id = comment.get("parent_id")

        if parent_id and parent_id in comment_map:
            parent = comment_map[parent_id]
            parent.setdefault("comments", []).append(comment)

    return [comment for comment in comments if comment["parent_id"] is None or comment["parent_id"] == post_id]


async def upload_dataset_file(file: UploadFile, dataset_id: str) -> str:
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are allowed.")
    
    file_path = f"{DATASETS_DIR}/{dataset_id}/{file.filename}"
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    async with async_open(file_path, "wb") as f:
        await f.write(await file.read())

    return file_path

async def stream_upload_file(file: UploadFile) -> dict:
    filename = f"{uuid4().hex}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    async with async_open(file_path, "wb") as out_file:
        while chunk := await file.read(1024 * 1024):  # Read in chunks of 1MB
            await out_file.write(chunk)

    return {"message": f"File {file.filename} uploaded successfully.", "path": file_path}

# async def save_uploaded_file(file: UploadFile, dataset_id: str) -> str:
#     """Save an uploaded file and return the file path."""
#     if not file.filename.endswith(".json"):
#         raise ValueError("Only JSON files are allowed.")

#     file_path = f"./datasets/{dataset_id}/{file.filename}"
#     os.makedirs(os.path.dirname(file_path), exist_ok=True)

#     async with async_open(file_path, "wb") as f:
#         while chunk := await file.read(1024 * 1024):  # 1MB chunks
#             await f.write(chunk)

#     return file_path

# def create_dataset(description: str, dataset_id: str = None):
#     """Create or retrieve a dataset ID."""
#     dataset_id = dataset_id or str(uuid4())
#     dataset_repo.insert(Dataset(id=dataset_id, name="", description=description))
#     return dataset_id

# async def upload_dataset_file(file: UploadFile, dataset_id: str):
#     """Upload a JSON file and return its path."""
#     return await save_uploaded_file(file, dataset_id)

# def list_datasets():
#     """List all datasets."""
#     return dataset_repo.find()

# def delete_dataset(dataset_id: str):
#     """Delete a dataset."""
#     dataset_repo.delete({"id": dataset_id})
#     return {"message": "Dataset deleted successfully!"}


def omit_first_if_matches_structure(data: list) -> list:
    if data and isinstance(data[0], dict) and "id" not in data[0]:
        return data[1:]
    return data


def parse_reddit_files(dataset_id: str, dataset_path: str = None, date_filter: dict[str,datetime] = None):

    existing_posts_count = post_repo.count({"dataset_id": dataset_id})
    if existing_posts_count > 0:
        post_repo.delete({"dataset_id": dataset_id})

    existing_comments_count = comment_repo.count({"dataset_id": dataset_id})
    if existing_comments_count > 0:
        comment_repo.delete({"dataset_id": dataset_id})

    dataset_path = dataset_path or os.path.join(DATASETS_DIR,dataset_id)
    post_files = [f for f in os.listdir(dataset_path) if f.startswith("RS") and f.endswith(".json")]
    comment_files = [f for f in os.listdir(dataset_path) if f.startswith("RC") and f.endswith(".json")]

    all_files = [{"type": "submissions", "path": f"{dataset_path}/{file}"} for file in post_files] + \
                [{"type": "comments", "path": f"{dataset_path}/{file}"} for file in comment_files]

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
        with open(file["path"], "r") as f:
            raw_data = json.load(f)

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
                    created_utc=p.get("created_utc", 0),
                    url=p.get("url", ""),
                    num_comments=p.get("num_comments", 0),
                    title=p.get("title", ""),
                    selftext=p.get("selftext", ""),
                    author=p.get("author", ""),
                    hide_score=p.get("hide_score", 0),
                    subreddit_id=p.get("subreddit_id", ""),
                    dataset_id=dataset_id
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
                subreddit = c.get("subreddit", subreddit)  # Update subreddit from comments
                comments.append(Comment(
                    id=c["id"],
                    body=c.get("body", ""),
                    author=c.get("author", ""),
                    post_id=c.get("link_id", "").split("_")[1] if "link_id" in c else None,
                    created_utc=c.get("created_utc", 0),
                    link_id=c.get("link_id", "").split("_")[1] if "link_id" in c else None,
                    parent_id=c.get("parent_id", "").split("_")[1] if "parent_id" in c else None,
                    controversiality=c.get("controversiality", 0),
                    score_hidden=c.get("score_hidden", 0),
                    score=c.get("score", 0),
                    subreddit_id=c.get("subreddit_id", ""),
                    retrieved_on=c.get("retrieved_on", 0),
                    gilded=c.get("gilded", 0),
                    dataset_id=dataset_id
                ))
            comment_repo.insert_batch(comments)


    update_dataset(dataset_id, name=subreddit)

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
        print("Error output:", stderr.decode())
    else:
        print("Command executed successfully.")
    return stdout.decode()

async def process_reddit_data(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    subreddit: str,
    zst_filename: str,
):
    # Create a unique intermediate filename
    directory = os.path.dirname(zst_filename)
    intermediate_filename = f"output_{time.time()}.jsonl"
    # output_dir = directory.replace(" ", "\\ ")
    intermediate_file = os.path.join(directory, intermediate_filename)#.replace(" ", "\ ")
    print(f"Intermediate file: {intermediate_file}")

    regex = r'(?s)\{.*?"subreddit":\s*"' + subreddit + r'".*?\}'

    # Use the PATHS dictionary to get the executable paths
    zstd_executable = PATHS["executables"]["zstd"]
    ripgrep_executable = PATHS["executables"]["ripgrep"]

    # Build the command string using the absolute paths
    escaped_intermediate_file = intermediate_file.replace(" ", "\\ ")
    command = (
        f'"{zstd_executable}" -cdq --memory=2048MB -T8 "{zst_filename}" | '
        f'"{ripgrep_executable}" -P \'{regex}\' > {escaped_intermediate_file}  || true'
    )
    print("Running command:")
    print(command)
    
    message = f"Extracting {subreddit} data from {zst_filename}..."
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)
    
    await run_command_async(command)

    # Create the output JSON file name based on the original zst_filename
    base = os.path.splitext(os.path.basename(zst_filename))[0]
    output_filename = os.path.join(directory, f"{base}.json")

    # Process the intermediate file and convert to a JSON array
    with open(intermediate_file, "r", encoding="utf-8") as infile, \
         open(output_filename, "w", encoding="utf-8") as outfile:
        outfile.write("[\n")
        first = True
        for line in infile:
            try:
                obj = json.loads(line.strip())
                if obj.get("subreddit") == subreddit:
                    if not first:
                        outfile.write(",\n")
                    outfile.write(json.dumps(obj, ensure_ascii=False))
                    first = False
            except json.JSONDecodeError:
                print("Skipping invalid JSON line.")
        outfile.write("\n]\n")
    
    print(f"Processed data saved to {output_filename}")
    message = f"JSON extracted: {output_filename}"
    print(message)
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)
    
    # Remove the intermediate file
    try:
        os.remove(f"{intermediate_file}")
        print(f"Intermediate file {intermediate_filename} removed.")
    except Exception as e:
        print(f"Warning: Could not remove intermediate file {intermediate_filename}: {e}")
    
    return output_filename



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
        c: Client, torrent: Torrent ,
) -> Torrent:
    c.start_torrent(torrent.id)
    while torrent.metadata_percent_complete < 1.0:
        message = f"Metadata progress: {torrent.metadata_percent_complete * 100:.2f}%"
        print(message)
        await manager.send_message(app_id, message)
        update_run_progress(run_id, message)
        await asyncio.sleep(0.5)
        torrent = c.get_torrent(torrent.id)

    message = "Metadata download complete. Stopping torrent."
    print(message)
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)
    c.stop_torrent(torrent.id)
    return torrent


async def verify_torrent_with_retry(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
        c: Client, torrent: Torrent, 
        torrent_url: str, download_dir: str,
) -> Torrent:
    c.verify_torrent(torrent.id)
    while True:
        torrent = c.get_torrent(torrent.id)
        status = torrent.status
        print(f"Torrent status: {status}")
        if hasattr(torrent, "error") and torrent.error != 0:
            message = f"Verification error: {torrent.error_string}. Re-adding torrent..."
            print(message)
            await manager.send_message(app_id, message)
            update_run_progress(run_id, message)

            c.remove_torrent(torrent.id)
            await asyncio.sleep(10)
            torrent = c.add_torrent(torrent_url, download_dir=download_dir)
            c.verify_torrent(torrent.id)
            continue
        if status not in ["check pending", "checking"]:
            print("Torrent status is not 'check pending' or 'checking' - breaking.", status)
            break
        message = f"Verification in progress: {status}"
        print(message)
        await manager.send_message(app_id, message)
        update_run_progress(run_id, message)
        await asyncio.sleep(5)
    message = "Torrent verified. Starting download."
    print(message)
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)
    return torrent


def get_files_to_process(torrent_files: list[TorrentFile], wanted_range: list, submissions_only: bool) -> list[TorrentFile]:
    files_to_process = []
    for file in torrent_files:
        print(file.name, file.name.split("_")[1], file.name.split("_")[1] in wanted_range)
        filename = os.path.splitext(os.path.basename(file.name))[0]
        print(filename)
        if submissions_only and not filename.startswith("RS"):
            continue
        if filename.split("_")[1] in wanted_range:
            print(f"Adding file {file.name} to the list.")
            files_to_process.append(file)
    return files_to_process


async def process_single_file(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
        c: Client, 
        torrent: Torrent, 
        file: TorrentFile, 
        download_dir: str, 
        subreddit: str,
):
    file_id = file.id
    file_name = file.name
    print(f"\n--- Processing file: {file_name} (ID: {file_id}) ---")

    message = f"Processing file: {file_name} ..."
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)

    torrent_files = c.get_torrent(torrent.id).get_files()
    all_file_ids = [f.id for f in torrent_files]
    other_ids = [fid for fid in all_file_ids if fid != file_id]
    c.change_torrent(torrent.id, files_wanted=[file_id], files_unwanted=other_ids)

    c.start_torrent(torrent.id)
    print(f"Downloading file {file_name}...")

    while True:
        torrent = c.get_torrent(torrent.id)

        if hasattr(torrent, "error") and torrent.error != 0:
            err_msg = f"ERROR downloading {file_name}: {torrent.error_string}"
            print(err_msg)
            await manager.send_message(app_id, err_msg)
            update_run_progress(run_id, err_msg)
            raise Exception(err_msg)
        
        file_status = next((f for f in torrent.get_files() if f.id == file_id), None)
        if file_status and file_status.completed >= file_status.size:
            print(f"File {file_name} has been fully downloaded.")
            message = f"File {file_name} fully downloaded ({file_status.completed}/{file_status.size} bytes)."
            print(message)
            await manager.send_message(app_id, message)
            update_run_progress(run_id, message)
            break
        else:
            if file_status and file_status.size != 0:
                pct_done = (file_status.completed / file_status.size) * 100
                message = f"Downloading {file_name}: {pct_done:.2f}% ({file_status.completed}/{file_status.size} bytes)"
                print(message)
                await manager.send_message(app_id, message)
                update_run_progress(run_id, message)
            else:
                print(f"Waiting for file {file_name} to start...")
            await asyncio.sleep(5)

    file_path = os.path.join(download_dir, file_name)
    file_path_zst = file_path if file_path.endswith('.zst') else file_path + '.zst'

    while not os.path.exists(file_path_zst):
        message = f"Waiting for file {file_path_zst} to appear on disk..."
        print(message)
        await manager.send_message(app_id, message)
        update_run_progress(run_id, message)
        await asyncio.sleep(5)

    output_file = await process_reddit_data(manager, app_id, run_id, subreddit, file_path_zst)

    message = f"Processed file: {file_name} ..."
    # print(message)
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)
    print(f"Processing complete for file {file_name}.")

    c.stop_torrent(torrent.id)
    await asyncio.sleep(1)
    return output_file


async def get_reddit_data_from_torrent(
    manager: ConnectionManager,
    app_id: str,
    run_id: str,
    dataset_id: str,
    workspace_id: str,
    subreddit: str,
    start_month: str = "2005-06",
    end_month: str = "2023-12",
    submissions_only: bool = True,
):
    TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR = os.path.abspath(PATHS["transmission"])
    torrent_hash_string = ACADEMIC_TORRENT_MAGNET.split("btih:")[1].split("&")[0]
    
    c = Client(host="localhost", port=9091, username="transmission", password="password")

    torrents = c.get_torrents()
    if not any(t.hashString == torrent_hash_string for t in torrents):
        # c.remove_torrent()
        # await asyncio.sleep(10)
        c.add_torrent(ACADEMIC_TORRENT_MAGNET, download_dir=TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)
    current_torrent = c.get_torrent(torrent_hash_string)

    print("Current download dir: ", current_torrent.download_dir, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)
    if current_torrent.download_dir != TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR:
        c.move_torrent_data(current_torrent.id, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)
        await asyncio.sleep(10)
        c.verify_torrent(current_torrent.id)
        await asyncio.sleep(10)
        current_torrent = c.get_torrent(torrent_hash_string)
        # c.remove_torrent(current_torrent.id)
        # await asyncio.sleep(10)
        # current_torrent = c.add_torrent(ACADEMIC_TORRENT_MAGNET, download_dir=TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)

    message = f"Torrent added for subreddit '{subreddit}' with ID: {current_torrent.id}"
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)


    current_torrent = await wait_for_metadata(manager, app_id, run_id, c, current_torrent)
    torrent_files = current_torrent.get_files()
    wanted_range = generate_month_range(start_month, end_month)
    print(f"Identified files for processing: {wanted_range}")
    files_to_process = get_files_to_process(torrent_files, wanted_range, submissions_only)
    print(f"Files to process: {files_to_process}")
    message = f"Files to process: {len(files_to_process)}"
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)

    file_repo.insert_batch(
        list(map(lambda f: FileStatus(run_id=run_id, file_name=f.name,workspace_id=workspace_id, dataset_id=dataset_id), files_to_process))
    )

    current_torrent = await verify_torrent_with_retry(manager, app_id, run_id, c, current_torrent, ACADEMIC_TORRENT_MAGNET, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR)

    output_files = []
    for file in files_to_process:
        output_file = await process_single_file(manager, app_id, run_id, c, current_torrent, file, TRANSMISSION_ABSOLUTE_DOWNLOAD_DIR, subreddit)
        output_files.append(output_file)
    
    message = "All wanted files have been processed."
    print(message)
    await manager.send_message(app_id, message)
    update_run_progress(run_id, message)
    return output_files



def filter_posts_by_deleted(dataset_id: str):
    return post_repo.get_filtered_post_ids(dataset_id)