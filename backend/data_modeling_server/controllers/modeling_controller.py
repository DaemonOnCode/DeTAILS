import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
from typing import Any, Dict, List
from uuid import uuid4

from fastapi import HTTPException
import pandas as pd
import spacy
from spacy.language import Language
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

from database import TokenizedPostsRepository, TokenizedCommentsRepository, PostsRepository, CommentsRepository, ModelsRepository, execute_query
from decorators import log_execution_time
from models.modeling_models import TopicModelingRequest
from models import TokenizedPost, TokenizedComment, Model
from routes.websocket_routes import ConnectionManager, manager
from utils.topic_modeling import bertopic_modeling, biterm_topic_modeling, lda_topic_modeling, llm_topic_modeling, nnmf_topic_modeling

posts_repo = PostsRepository()
comments_repo = CommentsRepository()
tokenized_posts_repo = TokenizedPostsRepository()
tokenized_comments_repo = TokenizedCommentsRepository()
models_repo = ModelsRepository()

# Batch Tokenization Function
def preprocess_tokenization_batch(nlp: Language, data: List[str]) -> List[List[str]]:
    """
    Tokenize a batch of text data efficiently, skipping stop words.
    """
    if not data:
        return []

    docs = nlp.pipe(data, n_process=-1, batch_size=1000)  # Parallelize with 4 processes
    return [[token.text for token in doc if not token.is_stop] for doc in docs]

# Function to check if preprocessing is needed
def is_preprocessing_needed(dataset_id: str, table: str) -> bool:
    """
    Check if preprocessing is needed for the given dataset_id and table.
    """
    if table == "posts":
        total_records = posts_repo.count({"dataset_id": dataset_id})
        tokenized_records = tokenized_posts_repo.count({"dataset_id": dataset_id})
    elif table == "comments":
        total_records = comments_repo.count({"dataset_id": dataset_id})
        tokenized_records = tokenized_comments_repo.count({"dataset_id": dataset_id})
    else:
        raise ValueError(f"Invalid table: {table}")
    
    print(f"Total {table}: {total_records}, Tokenized {table}: {tokenized_records}")
    return total_records != tokenized_records

# Function to process posts with higher parallelization
async def process_posts_batch_parallel(app_id: str, nlp, dataset_id: str, batch_size: int, total_records: int, num_threads: int, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    def process_batch(batch: List[Dict[str, Any]]):
        post_ids = [row["id"] for row in batch]
        titles = [row["title"] or "" for row in batch]  # Use empty string if title is None
        selftexts = [row["selftext"] or "" for row in batch]

        # Tokenize titles and selftexts
        tokenized_titles = preprocess_tokenization_batch(nlp, titles)
        tokenized_selftexts = preprocess_tokenization_batch(nlp, selftexts)

        tokenized_posts_repo.insert_batch([
            TokenizedPost(
                post_id=post_ids[i],
                title=" ".join(tokenized_titles[i]),
                body=" ".join(tokenized_selftexts[i]),
                dataset_id=dataset_id
            )
            for i in range(len(batch))
        ])

        return len(batch)

    print("Processing posts in parallel")
    processed_count = 0
    await send_broadcast(app_id, 
            manager=manager,
            type_=type_,
            dataset_id=dataset_id,
            model_id=model_id,
            model_name=model_name,
            workspace_id=request.workspace_id,
            num_topics=request.num_topics,
            message=f"preprocessing|posts|{0:.2f}"
        )
    await asyncio.sleep(0)

    while True:
        print("Fetching posts", batch_size)

        posts = posts_repo.fetch_unprocessed_posts(dataset_id, batch_size, num_threads)
        if not posts:
            break

        # Divide the large batch into smaller chunks
        chunks = [posts[i:i + batch_size] for i in range(0, len(posts), batch_size)]

        # Process chunks in parallel
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            results = executor.map(process_batch, chunks)
            processed_count += sum(results)

        # Calculate and broadcast progress
        progress = (processed_count / total_records) * 100
        print(f"Processed {processed_count} posts. Progress: {progress:.2f}%")
        await send_broadcast(app_id, 
                manager=manager,
                type_=type_,
                dataset_id=dataset_id,
                model_id=model_id,
                model_name=model_name,
                workspace_id=request.workspace_id,
                num_topics=request.num_topics,
                message=f"preprocessing|posts|{progress:.2f}"
            )
        await asyncio.sleep(0)

# Function to process comments with higher parallelization
async def process_comments_batch_parallel(app_id: str, nlp, dataset_id: str, batch_size: int, total_records: int, num_threads: int, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    def process_batch(batch: List[Dict[str, Any]]):
        comment_ids = [row["id"] for row in batch]
        bodies = [row["body"] or "" for row in batch]  # Use empty string if body is None

        # Tokenize bodies
        tokenized_bodies = preprocess_tokenization_batch(nlp, bodies)

        tokenized_comments_repo.insert_batch([
            TokenizedComment(
                comment_id=comment_ids[i],
                body=" ".join(tokenized_bodies[i]),
                dataset_id=dataset_id
            )
            for i in range(len(batch))
        ])
        return len(batch)

    print("Processing comments in parallel")
    processed_count = 0
    await send_broadcast(app_id, 
            manager=manager,
            type_=type_,
            dataset_id=dataset_id,
            model_id=model_id,
            model_name=model_name,
            workspace_id=request.workspace_id,
            num_topics=request.num_topics,
            message=f"preprocessing|comments|{0:.2f}"
        )
    await asyncio.sleep(0)
    while True:
        print("Fetching comments", batch_size)

        comments = comments_repo.fetch_unprocessed_comments(dataset_id, batch_size, num_threads)
        if not comments:
            break

        # Divide the large batch into smaller chunks
        chunks = [comments[i:i + batch_size] for i in range(0, len(comments), batch_size)]

        # Process chunks in parallel
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            results = executor.map(process_batch, chunks)
            processed_count += sum(results)

        # Calculate and broadcast progress
        progress = (processed_count / total_records) * 100
        print(f"Processed {processed_count} comments. Progress: {progress:.2f}%")
        await send_broadcast(app_id, 
                manager=manager,
                type_=type_,
                dataset_id=dataset_id,
                model_id=model_id,
                model_name=model_name,
                workspace_id=request.workspace_id,
                num_topics=request.num_topics,
                message=f"preprocessing|comments|{progress:.2f}"
            )
        await asyncio.sleep(0)

# Async wrapper for process_posts_batch_parallel
async def process_posts_batch_parallel_async(nlp, dataset_id, batch_size, total_records, num_threads, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    await process_posts_batch_parallel(nlp, dataset_id, batch_size, total_records, num_threads, request, type_, model_name, model_id)


# Async wrapper for process_comments_batch_parallel
async def process_comments_batch_parallel_async(nlp, dataset_id, batch_size, total_records, num_threads, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    await process_comments_batch_parallel(nlp, dataset_id, batch_size, total_records, num_threads, request, type_, model_name, model_id)


# Wrapper function to process both posts and comments with high parallelization
async def process_and_tokenize(app_id: str, dataset_id: str, batch_size: int = 1000, num_threads: int = 4, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    posts_needed = is_preprocessing_needed(dataset_id, "posts")
    comments_needed = is_preprocessing_needed(dataset_id, "comments")

    if not posts_needed and not comments_needed:
        print(f"All posts and comments for dataset {dataset_id} are already tokenized.")
        return

    total_posts = posts_repo.count({"dataset_id": dataset_id})
    total_comments = comments_repo.count({"dataset_id": dataset_id})

    nlp = spacy.load("en_core_web_sm")
    for name in ["tagger", "parser", "ner", "textcat"]:
        if name in nlp.pipe_names:
            nlp.remove_pipe(name)

    # tasks = []
    if posts_needed:
        await process_posts_batch_parallel_async(app_id, nlp, dataset_id, batch_size, total_posts, num_threads, request, type_, model_name, model_id)
        
    if comments_needed:
        await process_comments_batch_parallel_async(app_id, nlp, dataset_id, batch_size, total_comments, num_threads, request, type_, model_name, model_id)




def preprocess_documents(documents: list[str]) -> list[list[str]]:
    stop_words = set(stopwords.words('english'))
    tokenized_documents = [
        [word for word in word_tokenize(doc.lower()) if word.isalnum() and word not in stop_words]
        for doc in documents
    ]
    return tokenized_documents

def save_topics_to_json(topics, filename="topics.json"):
    with open(filename, "w") as f:
        json.dump(topics, f, indent=4)

def save_document_topic_probabilities(doc_topic_probs, filename="doc_topic_probs.csv"):
    pd.DataFrame(doc_topic_probs).to_csv(filename, index=False)

def format_topics(model, feature_names, n_top_words=10):
    topics = []
    for topic_idx, topic in enumerate(model.components_):
        words = [feature_names[i] for i in topic.argsort()[:-n_top_words - 1:-1]]
        topics.append({"topic": topic_idx, "words": words})
    return topics

def check_preprocessing_done():
    result = execute_query("SELECT name FROM sqlite_master WHERE type='table' AND name='tokenized_posts'")
    return bool(result)


def add_model_to_db(dataset_id: str, method: str, num_topics: int) -> tuple[str, str]:
    # Query the database to count models with the same method

    count = models_repo.count({"method": method, "dataset_id": dataset_id}) + 1

    # Create a unique model ID
    model_id = str(uuid4())
    
    # Generate model name with the count
    model_name = f"{method} Model {count}"

    # Insert the new model into the database
    models_repo.insert(Model(
        id=model_id,
        dataset_id=dataset_id,
        model_name=model_name,
        method=method,
        num_topics=num_topics,
    ))

    return model_id, model_name


def update_model_in_db(model_id: str, topics: list[dict]):
    # Update the topics in the database
    models_repo.update({"id": model_id}, {"topics": json.dumps(topics), "finished_at": datetime.now()})

# Map method names to modeling functions
MODEL_FUNCTIONS = {
    "lda": lda_topic_modeling,
    "biterm": biterm_topic_modeling,
    "nnmf": nnmf_topic_modeling,
    "bertopic": bertopic_modeling,
    "llm": llm_topic_modeling,
}

# Common broadcast messages
async def send_broadcast(app_id: str, manager: ConnectionManager, type_: str, dataset_id: str, model_id: str, model_name:str, workspace_id: str, num_topics: int, message: str):
    print(f"Broadcasting {message} for {model_name} ({model_id})")
    models_repo.update({"id": model_id, "dataset_id": dataset_id}, {"stage": message if message != "end" else ""})
    await manager.send_message(
        app_id,
        json.dumps({
        "type": type_,
        "dataset_id": dataset_id,
        "model_id": model_id,
        "model_name": model_name,
        "workspace_id": workspace_id,
        "message": message,
        "num_topics": num_topics
    }))
    print(f"Broadcasted {message} for {model_name} ({model_id})")

# Common function to process topic modeling
@log_execution_time()
async def process_topic_modeling(
    app_id: str,
    request: TopicModelingRequest,
    manager,
    type_: str,
    modeling_function
):
    if not request.dataset_id or not request.workspace_id:
        raise HTTPException(status_code=400, detail="Dataset ID and Workspace ID are required.")
    try:
        model_id, model_name = add_model_to_db(request.dataset_id, type_, request.num_topics)

        # Broadcast initial messages
        await send_broadcast(app_id, manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "starting")
        await asyncio.sleep(5)
        await send_broadcast(app_id, manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "preprocessing")
        await asyncio.sleep(5)
        # Preprocessing
        loop = asyncio.get_event_loop()
        task = loop.run_in_executor(
            None,  # Default ThreadPoolExecutor
            lambda: asyncio.run(process_and_tokenize(
                app_id, request.dataset_id, 1000, 4, request, type_, model_name, model_id
            ))
        )
        await task
        await send_broadcast(app_id, manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "preprocessed")
        await asyncio.sleep(5)

        # Modeling
        await send_broadcast(app_id, manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "modeling")
        await asyncio.sleep(5)
        topics = modeling_function(request.num_topics)
        await send_broadcast(app_id, manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "modeled")
        await asyncio.sleep(5)

        # Update model in DB and finalize
        update_model_in_db(model_id, topics)
        await send_broadcast(app_id, manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "end")

        return {
            "method": type_,
            "topics": topics,
            "id": model_id,
            "model_name": model_name
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))
