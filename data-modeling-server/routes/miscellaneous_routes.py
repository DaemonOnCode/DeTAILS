from fastapi import APIRouter, Depends, HTTPException

from controllers.miscellaneous_controller import link_creator, normalize_text, search_slice
from database import PostsRepository, CommentsRepository
from database.db_helpers import get_post_and_comments_from_id
from models.miscellaneous_models import RedditPostByIdRequest, RedditPostIDAndTitleRequest, RedditPostIDAndTitleRequestBatch, RedditPostLinkRequest
from services.transmission_service import GlobalTransmissionDaemonManager, get_transmission_manager


router = APIRouter()

posts_repo = PostsRepository()
comments_repo = CommentsRepository()

@router.post("/get-link-from-post", response_model=dict)
async def get_reddit_post_link_endpoint(request: RedditPostLinkRequest):
    """Retrieve Reddit post link or comment link based on a text slice."""
    if not request.postId or not request.datasetId:
        raise HTTPException(status_code=400, detail="Post ID and Dataset ID are required.")

    dataset_id = request.datasetId
    post_id = request.postId
    comment_slice = request.commentSlice    

    post_data = posts_repo.find_one({"id": post_id, "dataset_id": dataset_id}, columns=["id", "selftext", "title", "subreddit", "url", "permalink"], map_to_model=False)

    if not post_data:
        raise HTTPException(status_code=404, detail="Post not found")

    comment_data = comments_repo.find({"post_id": post_id, "dataset_id": dataset_id}, columns=["parent_id", "body", "id"], map_to_model=False)

    print(f"Post data: {post_data}", f"Comment data: {comment_data}")

    normalized_comment_slice = normalize_text(comment_slice)

    # Check if slice exists in post
    if (
        normalized_comment_slice in normalize_text(post_data.get('title', '')) or
        normalized_comment_slice in normalize_text(post_data.get('selftext', ''))
    ):
        return {"link": link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}

    # Check in comments
    comment_id = next((comment["id"] for comment in comment_data if search_slice(comment, normalized_comment_slice)), None)

    if comment_id:
        return {"link": link_creator(comment_id, 'comment', post_data.get('id'), post_data.get('subreddit'))}

    return {"link": link_creator(post_data.get('id'), 'post', post_data.get('id'), post_data.get('subreddit'))}



@router.post("/get-post-from-id")
async def get_post_from_id_endpoint(request: RedditPostByIdRequest):
    """Retrieve a post and its comments, structured in a hierarchical format."""
    if not request.postId or not request.datasetId:
        raise HTTPException(status_code=400, detail="Post ID and Dataset ID are required.")

    dataset_id = request.datasetId
    post_id = request.postId

    return get_post_and_comments_from_id(post_id, dataset_id)


@router.post("/get-post-title-from-id-batch")
async def get_post_title_from_id_batch_endpoint(request: RedditPostIDAndTitleRequestBatch):
    """Retrieve post titles for multiple post IDs in a dataset."""
    if not request.post_ids or not request.dataset_id:
        raise HTTPException(status_code=400, detail="Missing post_ids or dataset_id")
    
    post_titles = posts_repo.find(
        filters={"dataset_id": request.dataset_id, "id": request.post_ids},
        columns=["id", "title", "selftext"],
        map_to_model=False
    )

    return post_titles


@router.post("/get-post-title-from-id")
async def get_post_title_from_id_endpoint(
    request: RedditPostIDAndTitleRequest
):
    post_id = request.post_id
    dataset_id = request.dataset_id
    if not post_id or not dataset_id: 
        return HTTPException(status_code=400, detail="Missing post_id or dataset_id")

    post = posts_repo.find_one({"dataset_id": dataset_id, "id": post_id}, columns=["id", "title", "selftext"])
    return post

@router.get("/check-transmission")
async def check_transmission_endpoint(
    transmission_manager: GlobalTransmissionDaemonManager = Depends(get_transmission_manager)
):
    return {"exists": False } # transmission_manager.transmission_present}