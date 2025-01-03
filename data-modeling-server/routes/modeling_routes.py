from concurrent.futures import ThreadPoolExecutor
import sqlite3
from typing import List
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from numpy import add
from pydantic import BaseModel
import spacy
from routes.websocket_routes import manager
from constants import DATABASE_PATH
from utils.topic_modeling import lda_topic_modeling, biterm_topic_modeling, nnmf_topic_modeling, bertopic_modeling, llm_topic_modeling

router = APIRouter()

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import pandas as pd




def initialize_database():
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                dataset_id TEXT,
                model_name TEXT,
                method TEXT,
                topics TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                finished_at TIMESTAMP,
                num_topics INTEGER,
                FOREIGN KEY (dataset_id) REFERENCES datasets(id)
            );
        """)
        conn.commit()

initialize_database()

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
        conn.commit()
        return cursor.fetchall()

# Batch Tokenization Function
def preprocess_tokenization_batch(nlp, data: List[str]) -> List[List[str]]:
    """
    Tokenize a batch of text data efficiently, skipping stop words.
    """
    if not data:
        return []

    docs = nlp.pipe(data, n_process=4)  # Parallelize with 4 processes
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

# Function to fetch and process a batch of posts
def process_posts_batch(nlp, dataset_id: str, batch_size: int):
    while True:
        print(f"Processing posts for dataset {dataset_id}, batch size: {batch_size}")
        posts = execute_query(f"""
            SELECT id, title, selftext FROM posts
            WHERE id NOT IN (SELECT post_id FROM tokenized_posts)
            AND dataset_id = ?
            LIMIT {batch_size}
        """, (dataset_id,))
        if not posts:
            break

        post_ids = [row[0] for row in posts]
        titles = [row[1] or "" for row in posts]  # Use empty string if title is None
        selftexts = [row[2] or "" for row in posts]

        # Tokenize titles and selftexts
        tokenized_titles = preprocess_tokenization_batch(nlp, titles)
        tokenized_selftexts = preprocess_tokenization_batch(nlp, selftexts)

        # Prepare data for insertion
        tokenized_posts_data = [
            (post_ids[i], " ".join(tokenized_titles[i]), " ".join(tokenized_selftexts[i]), dataset_id)
            for i in range(len(posts))
        ]

        # Insert into tokenized_posts
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.executemany("INSERT OR REPLACE INTO tokenized_posts (post_id, title, selftext, dataset_id) VALUES (?, ?, ?, ?)",tokenized_posts_data)
        print(f"Processed {len(posts)} posts.")

# Function to fetch and process a batch of comments
def process_comments_batch(nlp, dataset_id: str, batch_size: int):
    while True:
        print(f"Processing comments for dataset {dataset_id}, batch size: {batch_size}")
        comments = execute_query(f"""
            SELECT id, body FROM comments
            WHERE id NOT IN (SELECT comment_id FROM tokenized_comments)
            AND dataset_id = ?
            LIMIT {batch_size}
        """, (dataset_id,))
        if not comments:
            break

        comment_ids = [row[0] for row in comments]
        bodies = [row[1] or "" for row in comments]  # Use empty string if body is None

        # Tokenize bodies
        tokenized_bodies = preprocess_tokenization_batch(nlp, bodies)

        # Prepare data for insertion
        tokenized_comments_data = [
            (comment_ids[i], " ".join(tokenized_bodies[i]), dataset_id) for i in range(len(comments))
        ]

        # Insert into tokenized_comments
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.executemany("INSERT OR REPLACE INTO tokenized_comments (comment_id, body,  dataset_id) VALUES (?, ?, ?)",tokenized_comments_data)
        print(f"Processed {len(comments)} comments.")


# Wrapper function to run both tasks in parallel
def process_and_tokenize(dataset_id: str, batch_size: int = 1000):
     # Check if preprocessing is needed for posts and comments
    posts_needed = is_preprocessing_needed(dataset_id, "posts")
    comments_needed = is_preprocessing_needed(dataset_id, "comments")

    if not posts_needed and not comments_needed:
        print(f"All posts and comments for dataset {dataset_id} are already tokenized.")
        return
    
    # Create SpaCy model once and pass it to the worker functions
    nlp = spacy.load("en_core_web_sm")


    for name in ["ner", "textcat"]:
        if name in nlp.pipe_names:
            nlp.remove_pipe(name)
    
    with ThreadPoolExecutor() as executor:
        futures = []
        if posts_needed:
            futures.append(executor.submit(process_posts_batch, nlp, dataset_id, batch_size))
        if comments_needed:
            futures.append(executor.submit(process_comments_batch, nlp, dataset_id, batch_size))
        
        for future in futures:
            try:
                future.result()  # Raise exceptions if any
            except Exception as e:
                print("Error during processing:", e)




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
    count_query = "SELECT COUNT(*) FROM models WHERE method = ?"
    count_result = execute_query(count_query, (method,))
    count = count_result[0][0] + 1  # Add 1 for the new model

    # Create a unique model ID
    model_id = str(uuid4())
    
    # Generate model name with the count
    model_name = f"{method} Model {count}"

    # Insert the new model into the database
    execute_query(
        "INSERT INTO models (id, dataset_id, model_name, method, num_topics) VALUES (?, ?, ?, ?, ?)",
        (model_id, dataset_id, model_name, method, num_topics),
    )

    return model_id, model_name


def update_model_in_db(model_id: str, topics: list[dict]):
    # Update the topics in the database
    execute_query(
        "UPDATE models SET topics = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
        (json.dumps(topics), model_id),
    )

class TopicModelingRequest(BaseModel):
    num_topics: int = 10
    workspace_id: str
    dataset_id: str


@router.post("/model/lda")
async def lda_topic_model(request: TopicModelingRequest):
    if not request.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        model_id, model_name = add_model_to_db(request.dataset_id, "lda", request.num_topics)
        await manager.broadcast(f"""{{
            "type": "lda",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Starting"
        }}""")
        await manager.broadcast(f"""{{
            "type": "lda",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessing"
        }}""")
        process_and_tokenize(request.dataset_id)
        await manager.broadcast(f"""{{
            "type": "lda",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessed"
        }}""")
        topics = []
        await manager.broadcast(f"""{{
            "type": "lda",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeling"
        }}""")
        # topics = lda_topic_modeling(request.num_topics)
        await manager.broadcast(f"""{{
            "type": "lda",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeled"
        }}""")
        update_model_in_db(model_id, topics)
        await manager.broadcast(f"""{{
            "type": "lda",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "End"
        }}""")
        return {
            "method": "lda", 
            "topics": topics,
            "id": model_id, 
            "model_name": model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/model/biterm")
async def biterm_topic_model(request: TopicModelingRequest):
    if not request.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        model_id, model_name = add_model_to_db(request.dataset_id, "biterm", request.num_topics)
        await manager.broadcast(f"""{{
            "type": "biterm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Starting"
        }}""")
        await manager.broadcast(f"""{{
            "type": "biterm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessing"
        }}""")
        process_and_tokenize(request.dataset_id)
        await manager.broadcast(f"""{{
            "type": "biterm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessed"
        }}""")
        await manager.broadcast(f"""{{
            "type": "biterm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeling"
        }}""")
        topics = biterm_topic_modeling(request.num_topics)
        await manager.broadcast(f"""{{
            "type": "biterm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeled"
        }}""")
        update_model_in_db(model_id, topics)
        await manager.broadcast(f"""{{
            "type": "biterm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "End"
        }}""")
        return {
            "method": "biterm", 
            "topics": topics,
            "id": model_id, 
            "model_name": model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/model/nnmf")
async def nnmf_topic_model(request: TopicModelingRequest):
    if not request.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        model_id, model_name = add_model_to_db(request.dataset_id, "nnmf", request.num_topics)
        await manager.broadcast(f"""{{
            "type": "nnmf",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Starting"
        }}""")
        await manager.broadcast(f"""{{
            "type": "nnmf",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessing"
        }}""")
        process_and_tokenize(request.dataset_id)
        await manager.broadcast(f"""{{
            "type": "nnmf",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessed"
        }}""")
        await manager.broadcast(f"""{{
            "type": "nnmf",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeling"
        }}""")
        topics = nnmf_topic_modeling(request.num_topics)
        await manager.broadcast(f"""{{
            "type": "nnmf",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeled"
        }}""")
        update_model_in_db(model_id, topics)
        await manager.broadcast(f"""{{
            "type": "nnmf",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "End"
        }}""")
        return {
            "method": "nnmf", 
            "topics": topics,
            "id": model_id, 
            "model_name": model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/model/bertopic")
async def bertopic_model(request: TopicModelingRequest):
    try:
        model_id, model_name = add_model_to_db(request.dataset_id, "bertopic", request.num_topics)
        await manager.broadcast(f"""{{
            "type": "bertopic",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Starting"
        }}""")
        await manager.broadcast(f"""{{
            "type": "bertopic",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessing"
        }}""")
        process_and_tokenize(request.dataset_id)
        await manager.broadcast(f"""{{
            "type": "bertopic",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessed"
        }}""")
        await manager.broadcast(f"""{{
            "type": "bertopic",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeling"
        }}""")
        topics = bertopic_modeling(request.num_topics)
        await manager.broadcast(f"""{{
            "type": "bertopic",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeled"
        }}""")
        update_model_in_db(model_id, topics)
        await manager.broadcast(f"""{{
            "type": "bertopic",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "End"
        }}""")
        return {
            "method": "bertopic", 
            "topics": topics,
            "id": model_id, 
            "model_name": model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/model/llm")
async def llm_topic_model(request: TopicModelingRequest):
    try:
        model_id, model_name = add_model_to_db(request.dataset_id, "llm", request.num_topics)
        await manager.broadcast(f"""{{
            "type": "llm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Starting"
        }}""")
        await manager.broadcast(f"""{{
            "type": "llm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessing"
        }}""")
        process_and_tokenize(request.dataset_id)
        await manager.broadcast(f"""{{
            "type": "llm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Preprocessed"
        }}""")
        await manager.broadcast(f"""{{
            "type": "llm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeling"
        }}""")
        topics = llm_topic_modeling(request.num_topics)
        await manager.broadcast(f"""{{
            "type": "llm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "Modeled"
        }}""")
        update_model_in_db(model_id, topics)
        await manager.broadcast(f"""{{
            "type": "llm",
            "dataset_id": "{request.dataset_id}",
            "model_id": "{model_id}"
            "workspace_id": "{request.workspace_id}"
            "message": "End"
        }}""")
        return {
            "method": "llm", 
            "topics": topics,
            "id": model_id, 
            "model_name": model_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class MetadataRequest(BaseModel):
    dataset_id: str
    workspace_id: str
    model_id: str

@router.post("/metadata")
def get_metadata_for_model(request: MetadataRequest):
    if not request.dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        if not request.workspace_id or not request.dataset_id:
            raise HTTPException(status_code=400, detail="Workspace and dataset IDs are required.")
        model_query = "SELECT model_name, method, num_topics FROM models WHERE id = ? AND dataset_id = ?"
        model_result = execute_query(model_query, (request.model_id, request.dataset_id), keys=True)
        if not model_result:
            raise HTTPException(status_code=404, detail="Model not found.")
        model = model_result[0]

        return {
            "model_name": model["model_name"],
            "type": model["method"],
            "num_topics": model["num_topics"],
            "start_time": model["started_at"],
            "end_time": model["finished_at"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

# @router.post("/all-models")
# def get_models():
#     if not request.dataset_id:
#         raise HTTPException(status_code=400, detail="Dataset ID is required.")
#     models_query = "SELECT id, model_name, method FROM models"
#     models_result = execute_query(models_query, keys=True)
#     return models_result