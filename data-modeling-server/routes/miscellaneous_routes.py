import sqlite3
from fastapi import APIRouter, HTTPException
from httpx import get
from pydantic import BaseModel
from sqlalchemy import all_

from constants import DATABASE_PATH
from utils.db_helpers import get_post_with_comments


router = APIRouter()

class RedditPostLinkRequest(BaseModel):
    postId: str
    commentSlice: str
    datasetId: str

def normalize_text(text: str) -> str:
    """Normalize text by lowercasing, trimming, and replacing multiple spaces with a single space."""
    return ' '.join(text.lower().split()) if text else ""

def search_slice(comment, normalized_comment_slice):
        """Recursively search for the text slice in comments."""
        if not normalized_comment_slice:
            return None

        normalized_body = normalize_text(comment.get('body', ''))

        if normalized_comment_slice in normalized_body:
            print(f"Found in comment: {comment.get('body')}")
            return comment.get('id')

        for sub_comment in comment.get('comments', []):
            result = search_slice(sub_comment, normalized_comment_slice)
            if result:
                return result

        return None

def link_creator(id, type, postId, subreddit):
    if (type == 'post') :
        return f"https://www.reddit.com/r/{subreddit}/comments/{postId}/"
    elif (type == 'comment') :
        return f"https://www.reddit.com/r/{subreddit}/comments/{postId}/{id}/"

@router.post("/get-link-from-post", response_model=dict)
async def get_reddit_post_link(
    request: RedditPostLinkRequest
):
    post_id = request.postId
    comment_slice = request.commentSlice
    dataset_id = request.datasetId
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, selftext, title, subreddit, url, permalink
            FROM posts
            WHERE id = ? AND dataset_id = ?
            """,
            (post_id, dataset_id)
        )
        post_data = cursor.fetchone()
        post_data = dict(post_data)

        comment_data = cursor.execute(
            """
            SELECT parent_id, body, id
            FROM comments
            WHERE post_id = ? AND dataset_id = ?
            """,
            (post_id, dataset_id)
        ).fetchall()
        comment_data = [dict(row) for row in comment_data]

    print(f"Post data: {post_data}", f"Comment data: {comment_data}")

    normalized_comment_slice = normalize_text(comment_slice)

    # Check in post title and selftext
    if (
        normalized_comment_slice in normalize_text(post_data.get('title', '')) or
        normalized_comment_slice in normalize_text(post_data.get('selftext', ''))
    ):
        print(f"Found in post: {post_data.get('id')}")
        print(f"Link: {link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}")
        return {"link":link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}
    
    comment_id = None
    for comment in comment_data:
        result = search_slice(comment, normalized_comment_slice)
        if result:
            comment_id = result
            break

    if comment_id:
        print(f"Found in comment: {comment_id}")
        print(f"Link: {link_creator(comment_id, 'comment', post_data.get('id'), post_data.get('subreddit'))}")
        return {"link":link_creator(comment_id, 'comment', post_data.get('id'), post_data.get('subreddit'))}

    print(f"Link not found, returning post link: {post_data.get('id')}")
    print(f"Link: {link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}")
    return {"link":link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}


class RedditPostByIdRequest(BaseModel):
    postId: str
    datasetId: str

@router.post("/get-post-from-id")
async def get_post_from_id(
    request: RedditPostByIdRequest
):
    post_id = request.postId
    dataset_id = request.datasetId
    if not post_id or not dataset_id:
        return HTTPException(status_code=400, detail="Missing post_id or dataset_id")
    # post_data = get_post_with_comments(dataset_id, post_id)
    post_data = {}
    with sqlite3.connect(DATABASE_PATH) as conn:
        # print("connected")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        post = cursor.execute("SELECT id, title, selftext FROM posts WHERE id = ? AND dataset_id = ?", (post_id, dataset_id)).fetchone()

        post = dict(post) if post else {}
        # print(post, "post check")
        if not post:
            raise ValueError(f"Post with ID {post_id} not found")

        comments = cursor.execute("SELECT id, body, parent_id, author FROM comments WHERE post_id = ? AND dataset_id = ?", (post_id,dataset_id)).fetchall()

        comments = [dict(comment) for comment in comments]

        # print(comments, "comments check")
        # Build a recursive tree structure for comments
        comment_map = {comment["id"]: comment for comment in comments}
        comment_map = {comment["id"]: comment for comment in comments}
        # print(comment_map, "comment map")
        for comment in comments:
            # print(comment['parent_id'],comment['id'], post_id , "comment", comment['parent_id'] in comment_map, comment['parent_id'] in comment_map.keys())
            if comment["parent_id"] and comment["parent_id"] in comment_map:
                parent = comment_map[comment["parent_id"]]
                parent.setdefault("comments", []).append(comment)
                # print(parent, "parent")
        # print(post, "post check")
        top_level_comments = [comment for comment in comments if comment["parent_id"] == post_id]
        # print(top_level_comments, "top level comments")
        post_data = {**post, "comments": top_level_comments}
    return post_data

class RedditPostIDAndTitleRequestBatch(BaseModel):
    post_ids: list = None
    dataset_id: str


@router.post("/get-post-title-from-id-batch")
async def get_post_title_from_id(
    request: RedditPostIDAndTitleRequestBatch
):
    post_ids = request.post_ids
    dataset_id = request.dataset_id
    if not post_ids or not dataset_id: 
        return HTTPException(status_code=400, detail="Missing post_id or dataset_id")
    
    all_post_data = []
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        for post_id in post_ids:
            post = cursor.execute("SELECT id, title, selftext FROM posts WHERE id = ? AND dataset_id = ?", (post_id, dataset_id)).fetchone()
            post = dict(post) if post else {}
            post_data = {**post}
            # print(post_data)
            all_post_data.append(post_data)
    return all_post_data

class RedditPostIDAndTitleRequest(BaseModel):
    post_id: str
    dataset_id: str

@router.post("/get-post-title-from-id")
async def get_post_title_from_id(
    request: RedditPostIDAndTitleRequest
):
    post_id = request.post_id
    dataset_id = request.dataset_id
    if not post_id or not dataset_id: 
        return HTTPException(status_code=400, detail="Missing post_id or dataset_id")
    
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        post = cursor.execute("SELECT id, title, selftext FROM posts WHERE id = ? AND dataset_id = ?", (post_id, dataset_id)).fetchone()
        post = dict(post) if post else {}
        post_data = {**post}
        # print(post_data)
        return post_data