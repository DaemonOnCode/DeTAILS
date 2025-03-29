import json
import os
from fastapi import APIRouter, Depends, HTTPException
from google.oauth2 import service_account, credentials
from google.auth.transport.requests import Request
import google.auth.exceptions
from langchain_google_vertexai import ChatVertexAI, VertexAI, VertexAIEmbeddings
from google.auth import load_credentials_from_file
import openai
import requests

import config
from controllers.miscellaneous_controller import get_credential_path, link_creator, normalize_text, search_slice
from database import PostsRepository, CommentsRepository, FunctionProgressRepository
from database.db_helpers import get_post_and_comments_from_id
from errors.credential_errors import InvalidCredentialError, MissingCredentialError
from errors.llm_errors import UnsupportedEmbeddingModelError
from errors.vertex_ai_errors import InvalidGenAIModelError, InvalidTextEmbeddingError
from models.miscellaneous_models import EmbeddingTestRequest, FunctionProgressRequest, ModelTestRequest, RedditPostByIdRequest, RedditPostIDAndTitleRequest, RedditPostIDAndTitleRequestBatch, RedditPostLinkRequest, UserCredentialTestRequest
from services.langchain_llm import LangchainLLMService, get_llm_service
from services.transmission_service import GlobalTransmissionDaemonManager, get_transmission_manager


router = APIRouter()

posts_repo = PostsRepository()
comments_repo = CommentsRepository()
function_progress_repo = FunctionProgressRepository()

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
    return {"exists": transmission_manager.transmission_present}


@router.post("/test-user-credentials")
async def test_user_credentials_endpoint(
    request_body: UserCredentialTestRequest,
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    provider = request_body.provider.lower().strip()
    credential = request_body.credential.strip()

    if provider in ("vertexai"):
        if not os.path.exists(credential):
            raise MissingCredentialError(f"The file '{credential}' does not exist.")

        if not credential.endswith('.json'):
            raise MissingCredentialError("The file is not a JSON file.")

        try:
            with open(credential, 'r') as f:
                data = json.load(f)
        except json.JSONDecodeError:
            raise MissingCredentialError("The file is not a valid JSON.")

        cred_type = data.get('type')
        if not cred_type:
            raise InvalidCredentialError("Credential type not found in JSON.")

        if cred_type == 'service_account':
            try:
                creds = service_account.Credentials.from_service_account_file(
                    credential,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                creds.refresh(Request())
            except Exception as e:
                raise InvalidCredentialError("Service Account credentials are invalid or revoked.")
        elif cred_type == 'authorized_user':
            try:
                creds = credentials.Credentials(
                    token=None,
                    refresh_token=data.get("refresh_token"),
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=data.get("client_id"),
                    client_secret=data.get("client_secret"),
                    scopes=["https://www.googleapis.com/auth/cloud-platform"]
                )
                creds.refresh(Request())
            except Exception as e:
                raise InvalidCredentialError("User credentials are invalid or expired.")
        else:
            raise InvalidCredentialError("Unknown credential type.")
        print(f"Validated credentials for provider '{provider}' via JSON file.")
        return {"valid": True}

    elif provider in ("openai", "google"):
        if not credential:
            raise MissingCredentialError("API key is missing.")

        if provider == "openai":
            try:
                client = openai.OpenAI(
                    api_key=credential,
                )
                client.models.list()
            except Exception as e:
                raise InvalidCredentialError("OpenAI API key is invalid or expired.")
        elif provider == "google":
            try:
                response = requests.get(
                    "https://aistudio.googleapis.com/v1/projects",
                    params={"key": credential},
                    timeout=5
                )
                if response.status_code != 200:
                    raise Exception("Non-200 status code")
            except Exception as e:
                raise InvalidCredentialError("Google AI Studio API key is invalid or expired.")
        print(f"Validated API key for provider '{provider}'.")
        return {"valid": True}
    
    else:
        raise InvalidCredentialError("Unsupported provider.")


@router.post("/test-model")
async def test_model_endpoint(
    request_body: ModelTestRequest,
    llm_service: LangchainLLMService = Depends(get_llm_service)
):
    full_model = f"{request_body.provider}-{request_body.name}"
    try:
        llm, _ = llm_service.get_llm_and_embeddings(full_model)
        llm.invoke("Hello!") 
        return {"success": True}
    except Exception as e:
        raise InvalidGenAIModelError(f"Failed to initialize or invoke LLM: {str(e)}")

@router.post("/test-embedding")
async def test_embedding_endpoint(
    request_body: EmbeddingTestRequest,
    llm_service: LangchainLLMService = Depends(get_llm_service)
):

    full_embedding = request_body.name
    try:
        if not llm_service.is_embedding_model_supported(full_embedding):
            raise UnsupportedEmbeddingModelError(f"Embedding model '{full_embedding}' is not supported")
        
        # provider_name, embedding_name = llm_service._extract_provider_and_model(full_embedding)
        provider_instance = llm_service.provider_factory.get_provider(request_body.provider)
        embeddings = provider_instance.get_embeddings(request_body.name)
        embeddings.embed_query("test")
        return {"success": True}
    except Exception as e:
        raise InvalidTextEmbeddingError(f"Failed to initialize or use embeddings: {str(e)}")

@router.post("/get-function-progress")
async def get_function_progress(
    request_body: FunctionProgressRequest
):
    workspace_id = request_body.workspace_id
    dataset_id = request_body.dataset_id
    name = request_body.name

    try:
        return function_progress_repo.find_one(
            {
                "workspace_id": workspace_id,
                "dataset_id": dataset_id,
                "name": name
            }
        )
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail="Failed to get function progress.")
    