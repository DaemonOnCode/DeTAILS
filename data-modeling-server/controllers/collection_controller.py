import json
import os
from uuid import uuid4
from aiofiles import open as async_open
from fastapi import HTTPException, UploadFile

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