import sqlite3
from fastapi import APIRouter
from pydantic import BaseModel

from constants import DATABASE_PATH


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
        return f"https://www.reddit.com/r/${subreddit}/comments/${postId}/"
    elif (type == 'comment') :
        return f"https://www.reddit.com/r/${subreddit}/comments/${postId}/${id}/"

@router.get("/get-link-from-post", response_model=dict)
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
            SELECT selftext, title, subreddit, url, permalink
            FROM posts
            WHERE id = ? AND dataset_id = ?
            """,
            (post_id, dataset_id)
        )
        post_data = cursor.fetchone()

        comment_data = cursor.execute(
            """
            SELECT parent_id, body, id
            FROM comments
            WHERE post_id = ? AND dataset_id = ?
            """,
            (post_id, dataset_id)
        ).fetchall()

    print(f"Post data: {post_data}", f"Comment data: {comment_data}")

    normalized_comment_slice = normalize_text(comment_slice)

    # Check in post title and selftext
    if (
        normalized_comment_slice in normalize_text(post_data.get('title', '')) or
        normalized_comment_slice in normalize_text(post_data.get('selftext', ''))
    ):
        print(f"Found in post: {post_data.get('id')}")
        return {"link":link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}
    
    comment_id = None
    for comment in comment_data:
        result = search_slice(comment, normalized_comment_slice)
        if result:
            comment_id = result
            break

    if comment_id:
        print(f"Found in comment: {comment_id}")
        return {"link":link_creator(comment_id, 'comment', post_data.get('id'), post_data.get('subreddit'))}

    print(f"Link not found, returning post link: {post_data.get('id')}")
    return {"link":link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}