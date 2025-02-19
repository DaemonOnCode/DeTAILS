import asyncio
from datetime import datetime
import json
import os
import subprocess
import time
from uuid import uuid4
from aiofiles import open as async_open
from fastapi import HTTPException, UploadFile
from transmission_rpc import Client

from constants import DATASETS_DIR, UPLOAD_DIR
from database import DatasetsRepository, CommentsRepository, PostsRepository
from models import Dataset, Comment, Post



dataset_repo = DatasetsRepository()
comment_repo = CommentsRepository()
post_repo = PostsRepository()

# Database repository
dataset_repo = DatasetsRepository()

def create_dataset(description: str, dataset_id: str = None, workspace_id: str = None):
    """Create a new dataset entry."""
    dataset_id = dataset_id or str(uuid4())
    dataset_repo.insert(Dataset(id=dataset_id, name="", description=description, workspace_id=workspace_id))
    return dataset_id

def list_datasets():
    """Retrieve all datasets."""
    return dataset_repo.find()

def update_dataset(dataset_id: str, **kwargs):
    """Update a dataset."""
    dataset_repo.update({"id": dataset_id}, kwargs)
    return {"message": "Dataset updated successfully"}

def delete_dataset(dataset_id: str):
    """Delete a dataset."""
    dataset_repo.delete({"id": dataset_id})
    return {"message": "Dataset deleted successfully"}

def get_reddit_posts_by_batch(dataset_id: str, batch: int, offset: int, all: bool):
    """Retrieve Reddit posts from a dataset in batches."""
    if all:
        return post_repo.find({"dataset_id": dataset_id})
    return post_repo.find({"dataset_id": dataset_id}, limit=batch, offset=offset)

def get_reddit_post_titles(dataset_id: str):
    """Get Reddit post titles from a dataset."""
    return post_repo.find({"dataset_id": dataset_id}, columns=["id", "title"])

def get_reddit_post_by_id(dataset_id: str, post_id: str):
    """Retrieve a specific Reddit post and its comments."""
    post = post_repo.find({"dataset_id": dataset_id, "id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = get_comments_recursive(post_id, dataset_id)
    return {**post[0], "comments": comments}

def get_comments_recursive(post_id: str, dataset_id: str):
    """Fetch comments recursively for a given Reddit post."""
    comments = comment_repo.find({"post_id": post_id, "dataset_id": dataset_id}, map_to_model=False)

    comment_map = {comment["id"]: comment for comment in comments}

    for comment in comments:
        parent_id = comment.get("parent_id")

        if parent_id and parent_id in comment_map:
            parent = comment_map[parent_id]
            parent.setdefault("comments", []).append(comment)

    return [comment for comment in comments if comment["parent_id"] is None or comment["parent_id"] == post_id]


async def upload_dataset_file(file: UploadFile, dataset_id: str) -> str:
    """Save an uploaded dataset file."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are allowed.")
    
    file_path = f"{DATASETS_DIR}/{dataset_id}/{file.filename}"
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    async with async_open(file_path, "wb") as f:
        await f.write(await file.read())

    return file_path

async def stream_upload_file(file: UploadFile) -> dict:
    """Stream and save an uploaded file in chunks."""
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
    """
    Omit the first element in a list if it doesn't match the expected structure.
    """
    if data and isinstance(data[0], dict) and "id" not in data[0]:
        return data[1:]
    return data


def parse_reddit_files(dataset_id: str):
    """Parse Reddit JSON files and insert into DB."""
    post_files = [f for f in os.listdir(f"datasets/{dataset_id}") if f.startswith("RS") and f.endswith(".json")]
    comment_files = [f for f in os.listdir(f"datasets/{dataset_id}") if f.startswith("RC") and f.endswith(".json")]

    all_files = [{"type": "submissions", "path": f"datasets/{dataset_id}/{file}"} for file in post_files] + \
                [{"type": "comments", "path": f"datasets/{dataset_id}/{file}"} for file in comment_files]

    subreddit = ""
    for file in all_files:
        with open(file["path"], "r") as f:
            raw_data = json.load(f)

        filtered_data = omit_first_if_matches_structure(raw_data)

        if file["type"] == "submissions":
            posts = []
            for p in filtered_data:
                subreddit = p.get("subreddit", subreddit)  # Keep subreddit updated
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


async def run_command_async(command: str):
    """
    Runs a shell command asynchronously and waits for its completion.
    Returns the command's stdout output as a string.
    """
    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    stdout, stderr = await process.communicate()
    
    # Optionally, handle errors if needed.
    if process.returncode != 0:
        print("Command failed with return code:", process.returncode)
        print("Error output:", stderr.decode())
    else:
        print("Command executed successfully.")
    
    return stdout.decode()


async def process_reddit_data(subreddit: str, zst_filename: str):
    # Name for the intermediate JSONL file.
    intermediate_filename = "output.jsonl"
    
    # Build the shell command.
    # Note: Escape curly braces for the regex.
    regex = r'(?s)\{.*?"subreddit":\s*"' + subreddit + r'".*?\}'

    # Build the full command string.
    # Using double quotes around the zst_filename and single quotes around the regex.
    command = (
        f'zstd -cdq --memory=2048MB -T8 "{zst_filename}" | '
        f"rg -P '{regex}' > {intermediate_filename} || true"
    )
    
    print("Running command:")
    print(command)
    
    # Run the command. If it fails, an exception will be raised.
    output = await run_command_async(command)
    
    # Derive an output filename based on the input .zst file.
    base = os.path.splitext(os.path.basename(zst_filename))[0]  # e.g., "RS_2023-02"
    directory = os.path.dirname(zst_filename)  # Get the directory from the full path.
    output_filename = os.path.join(directory, f"{base}.json")
    
    # Open the intermediate JSONL file for reading and the output file for writing.
    # Stream through the file line by line so that we don't load everything into memory.
    with open(intermediate_filename, "r", encoding="utf-8") as infile, \
         open(output_filename, "w", encoding="utf-8") as outfile:

        # Write the beginning of a JSON array.
        outfile.write("[\n")
        first = True  # Helps insert commas between JSON objects.
        for line in infile:
            try:
                obj = json.loads(line.strip())
                # Filter out any object that does not have the exact subreddit.
                if obj.get("subreddit") == subreddit:
                    if not first:
                        outfile.write(",\n")
                    outfile.write(json.dumps(obj, ensure_ascii=False))
                    first = False
            except json.JSONDecodeError:
                print("Skipping invalid JSON line.")
        # End the JSON array.
        outfile.write("\n]\n")
    
    print(f"Processed data saved to {output_filename}")

def wait_for_file_stable(file_path, stable_time=5, poll_interval=2):
    """
    Wait until the file's size remains unchanged for at least `stable_time` seconds.
    Returns True once the file is stable.
    """
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

async def get_reddit_data_from_torrent(subreddit: str, start_month: str = "2005-06", end_month: str = "2023-12", submissions_only: bool = True):
    # Set the download directory and torrent details.
    TRANSMISSION_DOWNLOAD_DIR = os.path.abspath("../transmission-downloads")
    torrent_hash_string = "9c263fc85366c1ef8f5bb9da0203f4c8c8db75f4"
    torrent_url = "magnet:?xt=urn:btih:9c263fc85366c1ef8f5bb9da0203f4c8c8db75f4&tr=https%3A%2F%2Facademictorrents.com%2Fannounce.php&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce"

    c = Client(host="localhost", port=9091, username="transmission", password="password")

    # Add the torrent if it's not already added.
    torrents = c.get_torrents()
    if not any(t.hashString == torrent_hash_string for t in torrents):
        c.add_torrent(torrent_url, download_dir=TRANSMISSION_DOWNLOAD_DIR)

    current_torrent = c.get_torrent(torrent_hash_string)

    # Start the torrent to fetch metadata.
    c.start_torrent(current_torrent.id)
    while current_torrent.metadata_percent_complete < 1.0:
        print(f"Metadata progress: {current_torrent.metadata_percent_complete * 100:.2f}%")
        time.sleep(0.5)
        current_torrent = c.get_torrent(current_torrent.id)
    print("Metadata download complete. Stopping torrent.")
    c.stop_torrent(current_torrent.id)

    # Obtain the complete file list from the torrent.
    torrent_files = current_torrent.get_files()

    # Identify the files you want based on the month range.
    wanted_range = generate_month_range(start_month, end_month)

    print(f"Identified files for processing: {wanted_range}")
    # Assume file names are structured so that the second underscore-delimited part is in YYYY-MM format.
    # files_to_process = [
    #     file for file in torrent_files
    #     if file.name.split("_")[1] in wanted_range
    # ]
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

    print(f"Files to process: {files_to_process}")

    c.verify_torrent(current_torrent.id)
    while True:
        current_torrent = c.get_torrent(current_torrent.id)
        status = current_torrent.status  # e.g., "Checking", "Check Pending", "Stopped", etc.

        if hasattr(current_torrent, "error") and current_torrent.error != 0:
            print(f"Verification error encountered: {current_torrent.error_string}. Re-adding torrent...")
            # Remove the problematic torrent. (Set delete_data=True if you want to remove the downloaded data.)
            c.remove_torrent(current_torrent.id)

            time.sleep(10)  # Short delay before re-adding the torrent.
            # Re-add the torrent. Make sure you have torrent_url and TRANSMISSION_DOWNLOAD_DIR available.
            current_torrent = c.add_torrent(torrent_url, download_dir=TRANSMISSION_DOWNLOAD_DIR)
            # Restart verification.
            # c.verify_torrent(current_torrent.id)
            # Optionally, wait a bit before retrying.
            # time.sleep(5)
            continue  # Restart loop after re-adding. 

        if status not in ["check pending", "checking"]:
            break
        print(f"Verification in progress: {status}")
        time.sleep(5)
    print("Torrent verified. Starting download.")

    # Process each wanted file one by one.
    for file in files_to_process:
        file_id = file.id
        file_name = file.name
        print(f"\n--- Processing file: {file_name} (ID: {file_id}) ---")

        # Mark only this file as wanted and set all others as unwanted.
        all_file_ids = [f.id for f in torrent_files]
        other_ids = [fid for fid in all_file_ids if fid != file_id]
        c.change_torrent(current_torrent.id, files_wanted=[file_id], files_unwanted=other_ids)

        # Start the torrent to download the current file.
        c.start_torrent(current_torrent.id)
        print(f"Downloading file {file_name}...")

        # Wait until the file is fully downloaded.
        while True:
            current_torrent = c.get_torrent(current_torrent.id)
            file_status = next((f for f in current_torrent.get_files() if f.id == file_id), None)
            if file_status and file_status.completed >= file_status.size:
                print(f"File {file_name} has been fully downloaded.")
                break
            else:
                print(f"Waiting for file {file_name} to complete... "
                    f"({file_status.completed}/{file_status.size} bytes)")
                time.sleep(10)

        # Build the expected file path.
        # If the file isn't already named with a .zst extension, assume it will be renamed to .zst after conversion.
        file_path = os.path.join(TRANSMISSION_DOWNLOAD_DIR, file_name)
        if not file_path.endswith('.zst'):
            file_path_zst = file_path + '.zst'
        else:
            file_path_zst = file_path

        # Wait until the converted .zst file appears on disk.
        while not os.path.exists(file_path_zst):
            print(f"Waiting for file {file_path_zst} to appear on disk (conversion in progress)...")
            time.sleep(5)

        # Wait until the file size is stable (i.e. no more changes) before processing.
        # print(f"Waiting for file {file_path_zst} to stabilize on disk...")
        # wait_for_file_stable(file_path_zst, stable_time=5, poll_interval=1)

        # Process the downloaded file.
        await process_reddit_data(subreddit, file_path)

        # Delete the processed file.
        # if os.path.exists(file_path):
        #     os.remove(file_path)
        #     print(f"Deleted file {file_name} after processing.")
        # else:
        #     print(f"File {file_name} not found for deletion.")

        # Optionally, stop the torrent before moving to the next file.
        c.stop_torrent(current_torrent.id)
        time.sleep(1)  # short delay before next iteration

    print("All wanted files have been processed.")


def generate_month_range(start_month, end_month):
    start = datetime.strptime(start_month, "%Y-%m")
    end = datetime.strptime(end_month, "%Y-%m")
    next_month = end.month % 12 + 1
    next_year = end.year + (1 if next_month == 1 else 0)
    end_exclusive = datetime(next_year, next_month, 1)
    
    wanted_range = []
    while start < end_exclusive:
        wanted_range.append(start.strftime("%Y-%m"))
        # Move to the next month.
        next_month = start.month % 12 + 1
        next_year = start.year + (1 if next_month == 1 else 0)
        start = datetime(next_year, next_month, 1)
    return wanted_range