import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import sqlite3
from typing import List
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Path
from numpy import add
import psutil
from pydantic import BaseModel
import spacy
from decorators.execution_time_logger import log_execution_time
from routes.websocket_routes import manager, ConnectionManager
from constants import DATABASE_PATH
from utils.topic_modeling import lda_topic_modeling, biterm_topic_modeling, nnmf_topic_modeling, bertopic_modeling, llm_topic_modeling
from spacy.language import Language

router = APIRouter()

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import pandas as pd

main_event_loop = asyncio.get_event_loop()


class TopicModelingRequest(BaseModel):
    num_topics: int = 10
    workspace_id: str
    dataset_id: str

# # Batch Tokenization Function
# def preprocess_tokenization_batch(nlp, data: List[str]) -> List[List[str]]:
#     """
#     Tokenize a batch of text data efficiently, skipping stop words.
#     """
#     if not data:
#         return []

#     docs = nlp.pipe(data,  n_process=4)  # Batch process
#     return [[token.text for token in doc if not token.is_stop] for doc in docs]


# Utility to execute SQL queries
def execute_query(query: str, params: tuple = (), keys = False) -> list[tuple]:
    """Utility function to execute SQL queries."""
    with sqlite3.connect(DATABASE_PATH) as conn:
        if keys:
            conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        result = cursor.fetchall()
        conn.commit()
        if keys:
            return [dict(row) for row in result]
        return result
    
def update_query(query: str, params: tuple = ()):
    """Utility function to execute SQL queries."""
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.rowcount

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
    total_records_query = f"SELECT COUNT(*) FROM {table} WHERE dataset_id = ?"
    tokenized_records_query = f"SELECT COUNT(*) FROM tokenized_{table} WHERE {table[:-1]}_id IN (SELECT id FROM {table} WHERE dataset_id = ?)"

    total_records = execute_query(total_records_query, (dataset_id,))[0][0]
    tokenized_records = execute_query(tokenized_records_query, (dataset_id,))[0][0]

    print(f"Total {table}: {total_records}, Tokenized {table}: {tokenized_records}")
    return total_records != tokenized_records

# Function to process posts with higher parallelization
async def process_posts_batch_parallel(nlp, dataset_id: str, batch_size: int, total_records: int, num_threads: int, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    def process_batch(batch):
        post_ids = [row[0] for row in batch]
        titles = [row[1] or "" for row in batch]  # Use empty string if title is None
        selftexts = [row[2] or "" for row in batch]

        # Tokenize titles and selftexts
        tokenized_titles = preprocess_tokenization_batch(nlp, titles)
        tokenized_selftexts = preprocess_tokenization_batch(nlp, selftexts)

        # Prepare data for insertion
        tokenized_posts_data = [
            (post_ids[i], " ".join(tokenized_titles[i]), " ".join(tokenized_selftexts[i]), dataset_id)
            for i in range(len(batch))
        ]

        # Insert into tokenized_posts
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.executemany(
                "INSERT OR REPLACE INTO tokenized_posts (post_id, title, selftext, dataset_id) VALUES (?, ?, ?, ?)",
                tokenized_posts_data,
            )
        return len(batch)

    print("Processing posts in parallel")
    processed_count = 0
    await send_broadcast(
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
        posts = execute_query(f"""
            SELECT id, title, selftext FROM posts
            WHERE id NOT IN (SELECT post_id FROM tokenized_posts)
            AND dataset_id = ?
            LIMIT {batch_size * num_threads}
        """, (dataset_id,))
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
        await send_broadcast(
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
async def process_comments_batch_parallel(nlp, dataset_id: str, batch_size: int, total_records: int, num_threads: int, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    def process_batch(batch):
        comment_ids = [row[0] for row in batch]
        bodies = [row[1] or "" for row in batch]  # Use empty string if body is None

        # Tokenize bodies
        tokenized_bodies = preprocess_tokenization_batch(nlp, bodies)

        # Prepare data for insertion
        tokenized_comments_data = [
            (comment_ids[i], " ".join(tokenized_bodies[i]), dataset_id) for i in range(len(batch))
        ]

        # Insert into tokenized_comments
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.executemany(
                "INSERT OR REPLACE INTO tokenized_comments (comment_id, body, dataset_id) VALUES (?, ?, ?)",
                tokenized_comments_data,
            )
        return len(batch)

    print("Processing comments in parallel")
    processed_count = 0
    await send_broadcast(
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
        comments = execute_query(f"""
            SELECT id, body FROM comments
            WHERE id NOT IN (SELECT comment_id FROM tokenized_comments)
            AND dataset_id = ?
            LIMIT {batch_size * num_threads}
        """, (dataset_id,))
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
        await send_broadcast(
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
async def process_and_tokenize(dataset_id: str, batch_size: int = 1000, num_threads: int = 4, request: TopicModelingRequest = {}, type_: str = "", model_name: str = "", model_id: str = ""):
    posts_needed = is_preprocessing_needed(dataset_id, "posts")
    comments_needed = is_preprocessing_needed(dataset_id, "comments")

    if not posts_needed and not comments_needed:
        print(f"All posts and comments for dataset {dataset_id} are already tokenized.")
        return

    total_posts = execute_query(f"SELECT COUNT(*) FROM posts WHERE dataset_id = ?", (dataset_id,))[0][0]
    total_comments = execute_query(f"SELECT COUNT(*) FROM comments WHERE dataset_id = ?", (dataset_id,))[0][0]

    nlp = spacy.load("en_core_web_sm")
    for name in ["tagger", "parser", "ner", "textcat"]:
        if name in nlp.pipe_names:
            nlp.remove_pipe(name)

    # tasks = []
    if posts_needed:
        await process_posts_batch_parallel_async(nlp, dataset_id, batch_size, total_posts, num_threads, request, type_, model_name, model_id)
        
    if comments_needed:
        await process_comments_batch_parallel_async(nlp, dataset_id, batch_size, total_comments, num_threads, request, type_, model_name, model_id)

    # # Run all tasks concurrently
    # await asyncio.gather(*tasks)



def preprocess_documents(documents: list[str]) -> list[list[str]]:
    stop_words = set(stopwords.words('english'))
    tokenized_documents = [
        [word for word in word_tokenize(doc.lower()) if word.isalnum() and word not in stop_words]
        for doc in documents
    ]
    return tokenized_documents


import json

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
    count_query = "SELECT COUNT(*) FROM models WHERE method = ? AND dataset_id = ?"
    count_result = execute_query(count_query, (method, dataset_id))
    count = count_result[0][0] + 1  # Add 1 for the new model

    # Create a unique model ID
    model_id = str(uuid4())
    
    # Generate model name with the count
    model_name = f"{method} Model {count}"

    # Insert the new model into the database
    execute_query(
        "INSERT INTO models (id, dataset_id, model_name, method, num_topics, started_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        (model_id, dataset_id, model_name, method, num_topics),
    )

    return model_id, model_name


def update_model_in_db(model_id: str, topics: list[dict]):
    # Update the topics in the database
    execute_query(
        "UPDATE models SET topics = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
        (json.dumps(topics), model_id),
    )

# Map method names to modeling functions
MODEL_FUNCTIONS = {
    "lda": lda_topic_modeling,
    "biterm": biterm_topic_modeling,
    "nnmf": nnmf_topic_modeling,
    "bertopic": bertopic_modeling,
    "llm": llm_topic_modeling,
}

# Common broadcast messages
async def send_broadcast(manager: ConnectionManager, type_: str, dataset_id: str, model_id: str, model_name:str, workspace_id: str, num_topics: int, message: str):
    print(f"Broadcasting {message} for {model_name} ({model_id})")
    execute_query(
        "UPDATE models SET stage = ? WHERE id = ? and dataset_id = ?",
        (message if message != "end" else "", model_id, dataset_id),
    )
    await manager.broadcast(json.dumps({
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
async def process_topic_modeling(
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
        await send_broadcast(manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "starting")
        await asyncio.sleep(5)
        await send_broadcast(manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "preprocessing")
        await asyncio.sleep(5)
        # Preprocessing
        loop = asyncio.get_event_loop()
        task = loop.run_in_executor(
            None,  # Default ThreadPoolExecutor
            lambda: asyncio.run(process_and_tokenize(
                request.dataset_id, 1000, 4, request, type_, model_name, model_id
            ))
        )
        await task
        await send_broadcast(manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "preprocessed")
        await asyncio.sleep(5)

        # Modeling
        await send_broadcast(manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "modeling")
        await asyncio.sleep(5)
        topics = modeling_function(request.num_topics)
        await send_broadcast(manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "modeled")
        await asyncio.sleep(5)

        # Update model in DB and finalize
        update_model_in_db(model_id, topics)
        await send_broadcast(manager, type_, request.dataset_id, model_id, model_name, request.workspace_id, request.num_topics, "end")

        return {
            "method": type_,
            "topics": topics,
            "id": model_id,
            "model_name": model_name
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

# Dynamic route to handle topic modeling methods
@router.post("/model/{method}")
@log_execution_time()
async def topic_model(
    method: str = Path(..., description="The topic modeling method to use"),
    request: TopicModelingRequest = None
):
    modeling_function = MODEL_FUNCTIONS.get(method)

    # Return 400 if the method is not supported
    if not modeling_function:
        raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

    return await process_topic_modeling(request, manager, method, modeling_function)



class MetadataRequest(BaseModel):
    dataset_id: str
    workspace_id: str
    model_id: str

@router.post("/metadata")
@log_execution_time()
def get_metadata_for_model(request: MetadataRequest):
    if not request.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        print(request.model_id, request.dataset_id, request.workspace_id)
        model_query = "SELECT * FROM models WHERE id = ? AND dataset_id = ?"
        model_result = execute_query(model_query, (request.model_id, request.dataset_id), keys=True)
        if not model_result:
            raise HTTPException(status_code=404, detail="Model not found.")
        model = model_result[0]

        print(model) 

        return {
            "id": model["id"],
            "model_name": model["model_name"],
            "type": model["method"],
            "num_topics": model["num_topics"],
            "start_time": model["started_at"],
            "end_time": model["finished_at"],
            "stage": model["stage"],
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))


class UpdateMetadataRequest(MetadataRequest):
    new_model_name: str

@router.put("/model")
@log_execution_time()
def update_metadata_for_model(request: UpdateMetadataRequest):
    model_id = request.model_id
    dataset_id = request.dataset_id
    workspace_id = request.workspace_id
    new_model_name = request.new_model_name
    print("Update", model_id, dataset_id, workspace_id, new_model_name)
    if not model_id or not dataset_id or not workspace_id:
        raise HTTPException(status_code=400, detail="Model ID is required.")
    try:
        model_query = "UPDATE models SET model_name = ? WHERE id = ? AND dataset_id = ?"
        model_result = update_query(model_query, (new_model_name, model_id, dataset_id))
        print(model_result)
        if not model_result:
            raise HTTPException(status_code=404, detail="Model not found.")
        return {
            "message": f"Model updated successfully."
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/model")
@log_execution_time()
def delete_model(request: MetadataRequest):
    model_id = request.model_id
    dataset_id = request.dataset_id
    workspace_id = request.workspace_id
    print("Delete", model_id, dataset_id, workspace_id)
    if not model_id or not dataset_id or not workspace_id:
        raise HTTPException(status_code=400, detail="Model ID is required.")
    try:
        model_query = "DELETE FROM models WHERE id = ? AND dataset_id = ?"
        model_result = update_query(model_query, (model_id, dataset_id))
        print(model_result)
        if not model_result:
            raise HTTPException(status_code=404, detail="Model not found.")
        return {
            "message": f"Model deleted successfully."
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

class ModelListRequest(BaseModel):
    dataset_id: str
    workspace_id: str

@router.post("/list-models")
@log_execution_time()
def get_models(request: ModelListRequest):
    if not request.dataset_id or not request.workspace_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    models_query = "SELECT * FROM models WHERE dataset_id = ?"
    models_result = execute_query(models_query, (request.dataset_id, ), keys=True)
    return models_result