from pathlib import Path
import random
import sqlite3
import time
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, HTTPException, Path, Query, Body
from pydantic import BaseModel
import spacy

from constants import DATABASE_PATH

# DATABASE_PATH = "example.db"

# Initialize FastAPI and spaCy
# Initialize FastAPI and spaCy
nlp = spacy.load("en_core_web_sm")
router = APIRouter()

# Utility to execute SQL queries
def execute_query(query: str, params: tuple = (), keys = False) -> List[tuple]:
    """Utility function to execute SQL queries."""
    with sqlite3.connect(DATABASE_PATH) as conn:
        if keys:
            conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.fetchall()

# Pydantic models
class Rule(BaseModel):
    id: Optional[int] = None
    step: int
    fields: str
    words: str
    pos: Optional[str] = None
    action: str

class DatasetRequest(BaseModel):
    dataset_id: str
    rules: list

# Database initialization
@router.on_event("startup")
def initialize_database():
    """Ensure required tables exist."""
    execute_query("""
        CREATE TABLE IF NOT EXISTS rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id TEXT NOT NULL,
            step INTEGER NOT NULL,
            fields TEXT NOT NULL,
            words TEXT NOT NULL,
            pos TEXT,
            action TEXT NOT NULL
        );
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS token_stats (
            dataset_id TEXT NOT NULL,
            removed_tokens TEXT,
            included_tokens TEXT,
            PRIMARY KEY (dataset_id)
        );
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS token_stats_detailed (
            dataset_id TEXT NOT NULL,
            token TEXT NOT NULL,
            pos TEXT,
            count_words INTEGER,
            count_docs INTEGER,
            tfidf_min REAL,
            tfidf_max REAL,
            status TEXT,
            PRIMARY KEY (dataset_id, token, status)
        );
    """)

# Fetch rules for a dataset (Path Param)
@router.get("/datasets/{dataset_id}/rules", response_model=List[Rule])
def get_rules(dataset_id: str = Path(...)):
    """Fetch rules for a dataset."""
    rows = execute_query("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))
    return [
        Rule(id=row[0], step=row[2], fields=row[3], words=row[4], pos=row[5], action=row[6])
        for row in rows
    ]

# Add or replace rules (Body Param)
@router.post("/rules", response_model=dict)
def add_rules(payload: DatasetRequest = Body(...)):
    """Add or replace rules for a dataset."""
    dataset_id = payload.dataset_id
    rules = payload.rules
    execute_query("DELETE FROM rules WHERE dataset_id = ?", (dataset_id,))
    for rule in rules:
        print(rule)
        execute_query("""
            INSERT INTO rules (dataset_id, step, fields, words, pos, action)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (dataset_id, rule["step"], rule["fields"], rule["words"], rule["pos"], rule["action"]))
    return {"message": "Rules added successfully"}

# Delete all rules for a dataset (Path Param)
@router.delete("/datasets/{dataset_id}/rules", response_model=dict)
def delete_all_rules(dataset_id: str = Path(...)):
    """Delete all rules for a dataset."""
    execute_query("DELETE FROM rules WHERE dataset_id = ?", (dataset_id,))
    return {"message": "All rules deleted successfully"}

# Create backup tables (Body Param)
@router.post("/datasets/backup", response_model=dict)
def create_backup(payload: DatasetRequest = Body(...)):
    """Create backups for posts and comments."""
    dataset_id = payload.dataset_id
    execute_query(f"""
        CREATE TABLE IF NOT EXISTS posts_backup_{dataset_id} AS
        SELECT * FROM posts WHERE dataset_id = ?
    """, (dataset_id,))
    execute_query(f"""
        CREATE TABLE IF NOT EXISTS comments_backup_{dataset_id} AS
        SELECT * FROM comments WHERE dataset_id = ?
    """, (dataset_id,))
    return {"message": "Backup created successfully"}


def update_token_stats_detailed(dataset_id: str, tokens: List[Dict[str, Any]], status: str):
    """
    Update the detailed token stats table for a dataset.
    
    Args:
        dataset_id (str): The ID of the dataset.
        tokens (List[Dict[str, Any]]): List of tokens with their POS, counts, and TF-IDF scores.
        status (str): 'included' or 'removed'.
    """
    sanitized_dataset_id = dataset_id.replace("-", "_")
    tfidf_values = calculate_tfidf(tokens, sanitized_dataset_id, "posts")
    tfidf_values.update(calculate_tfidf(tokens, sanitized_dataset_id, "comments"))

    # Prepare data for insertion
    rows = [
        (
            dataset_id,
            token['text'],
            token['pos'],
            token['count'],
            token['doc_count'],
            tfidf_values[token['text']]['min'],
            tfidf_values[token['text']]['max'],
            status
        )
        for token in tokens
    ]

    # print("Rows", rows)

    # Insert or update the token stats
    for row in rows:
        # print(row)
        execute_query_with_retry("""
            INSERT INTO token_stats_detailed (dataset_id, token, pos, count_words, count_docs, tfidf_min, tfidf_max, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(dataset_id, token, status) DO UPDATE SET
                count_words = excluded.count_words,
                count_docs = excluded.count_docs,
                tfidf_min = excluded.tfidf_min,
                tfidf_max = excluded.tfidf_max;
        """, row)

# Function to calculate TF-IDF scores
def calculate_tfidf(tokens: List[Dict[str, Any]], sanitized_dataset_id: str, type = "posts") -> Dict[str, Dict[str, float]]:
    """
    Calculate TF-IDF scores for tokens in a dataset.
    
    Args:
        tokens (List[Dict[str, Any]]): List of tokens with word counts and document counts.
        table_name (str): The table name to calculate the scores from.
        
    Returns:
        Dict[str, Dict[str, float]]: A dictionary mapping tokens to their TF-IDF min and max values.
    """
    full_table_name = f"{type}_backup_{sanitized_dataset_id}"
    total_docs = execute_query_with_retry(f"SELECT COUNT(*) FROM {full_table_name}")[0][0]
    tfidf_scores = {}

    for token in tokens:
        tf = token['count'] / total_docs  # Term frequency
        idf = max(1.0, total_docs / (1 + token['doc_count']))  # Inverse document frequency
        tfidf = tf * idf

        if token['text'] not in tfidf_scores:
            tfidf_scores[token['text']] = {"min": tfidf, "max": tfidf}
        else:
            tfidf_scores[token['text']]['min'] = min(tfidf_scores[token['text']]['min'], tfidf)
            tfidf_scores[token['text']]['max'] = max(tfidf_scores[token['text']]['max'], tfidf)

    return tfidf_scores

# Updated apply_rules_to_text to accumulate stats for tokens
def apply_rules_to_text(rules: List[Dict[str, Any]], text: str, dataset_id: str) -> str:
    """
    Apply rules to text, track token stats, and save detailed token stats.
    
    Args:
        rules (List[Dict[str, Any]]): Rules to apply.
        text (str): The text to process.
        dataset_id (str): The dataset ID.
    
    Returns:
        str: The processed text.
    """

    # print("Applying rules to text", rules, text, dataset_id)
    doc = nlp(text)
    tokens = []
    removed_tokens = {}
    included_tokens = {}

    for token in doc:
        keep_token = True
        for rule in rules:
            if rule["fields"] == "<ANY>" or rule["fields"] == "Title" or rule["fields"] == "Body":
                if (rule["words"] == "<ANY>" or rule["words"] == token.text) and \
                   (rule["pos"] is None or rule["pos"] == token.pos_):
                    if rule["action"] == "Remove":
                        keep_token = False
                        # Track removed tokens with POS
                        if token.text not in removed_tokens:
                            removed_tokens[token.text] = {"count": 0, "pos": token.pos_}
                        removed_tokens[token.text]["count"] += 1
                        break

        if keep_token:
            tokens.append(token.text)
            # Track included tokens with POS
            if token.text not in included_tokens:
                included_tokens[token.text] = {"count": 0, "pos": token.pos_}
            included_tokens[token.text]["count"] += 1

    # Prepare stats for removed and included tokens
    removed_tokens_list = [
        {"text": t, "count": data["count"], "pos": data["pos"], "doc_count": 1}
        for t, data in removed_tokens.items()
    ]
    included_tokens_list = [
        {"text": t, "count": data["count"], "pos": data["pos"], "doc_count": 1}
        for t, data in included_tokens.items()
    ]
    
    # Update token stats using external function
    update_token_stats_detailed(dataset_id, removed_tokens_list, "removed")
    update_token_stats_detailed(dataset_id, included_tokens_list, "included")

    return " ".join(tokens)

# def apply_rules_to_text(rules: List[Dict[str, Any]], text: str, dataset_id: str) -> str:
#     """
#     Apply rules to a given text and track removed and included tokens.
    
#     Args:
#         rules (List[Dict[str, Any]]): List of rules to apply.
#         text (str): Text to process.
#         dataset_id (str): Dataset ID for saving token stats.

#     Returns:
#         str: The processed text.
#     """
#     doc = nlp(text)
#     tokens = []
#     removed_tokens = set()
#     included_tokens = set()

#     for token in doc:
#         keep_token = True
#         for rule in rules:
#             if rule["fields"] == "<ANY>" or rule["fields"] == "Title" or rule["fields"] == "Body":
#                 if (rule["words"] == "<ANY>" or rule["words"] == token.text) and \
#                    (rule["pos"] is None or rule["pos"] == token.pos_ or rule["pos"] == ""):
#                     print(f"Applying rule: {rule}, Token: {token.text}, POS: {token.pos_}")
#                     if rule["action"] == "Remove":
#                         keep_token = False
#                         removed_tokens.add(token.text)
#                         break

#         if keep_token:
#             tokens.append(token.text)
#             included_tokens.add(token.text)

#     # Save removed and included tokens into the database
#     save_token_stats(dataset_id, removed_tokens, included_tokens)

#     return " ".join(tokens)


# def save_token_stats(dataset_id: str, removed_tokens: set, included_tokens: set):
#     """
#     Accumulate and save token stats (removed and included tokens) for a dataset.
    
#     Args:
#         dataset_id (str): Dataset ID.
#         removed_tokens (set): Set of removed tokens.
#         included_tokens (set): Set of included tokens.
#     """
#     # Fetch existing stats from the database
#     query = "SELECT removed_tokens, included_tokens FROM token_stats WHERE dataset_id = ?"
#     result = execute_query_with_retry(query, (dataset_id,))
#     # print(result, "result, result")

#     if result:
#         # Existing stats found
#         existing_removed_tokens = set(result[0][0].split(",")) if result[0][0] else set()
#         existing_included_tokens = set(result[0][1].split(",")) if result[0][1] else set()

#         # Merge the new tokens with the existing ones
#         removed_tokens = removed_tokens.union(existing_removed_tokens)
#         included_tokens = included_tokens.union(existing_included_tokens)

#     # Convert sets to comma-separated strings for storage
#     removed_tokens_str = ",".join(removed_tokens)
#     included_tokens_str = ",".join(included_tokens)

#     # Insert or update the token stats
#     query = """
#         INSERT INTO token_stats (dataset_id, removed_tokens, included_tokens)
#         VALUES (?, ?, ?)
#         ON CONFLICT(dataset_id) DO UPDATE SET
#             removed_tokens = excluded.removed_tokens,
#             included_tokens = excluded.included_tokens;
#     """
#     execute_query_with_retry(query, (dataset_id, removed_tokens_str, included_tokens_str))

# import concurrent.futures

# BATCH_SIZE = 100  # Define the size of each batch

import threading
from queue import Queue

def execute_query_with_retry(query: str, params: tuple = (), retries: int = 50, backoff: float = 0.1, jitter: float = 0.05) -> List[Tuple]:
    """
    Execute a SQL query with retry logic for handling database locks and random jitter.
    :param query: SQL query string.
    :param params: Parameters for the SQL query.
    :param retries: Number of retry attempts in case of a lock.
    :param backoff: Initial backoff time in seconds, which increases exponentially.
    :param jitter: Maximum random jitter to add to the backoff time.
    :return: Query results as a list of tuples.
    """
    for attempt in range(retries):
        try:
            with sqlite3.connect(DATABASE_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return cursor.fetchall()
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e).lower():
                if attempt < retries - 1:
                    # Add a small random jitter to the backoff time
                    time.sleep((backoff * (2 ** attempt)) + random.uniform(0, jitter))
                else:
                    raise Exception(f"Database is locked after {retries} attempts.") from e
            else:
                raise

def create_backup_table(dataset_id: str):
    """
    Create a backup table for posts if it does not exist.
    """
    
    # Create backup for posts

    sanitized_dataset_id = dataset_id.replace("-", "_")
    execute_query_with_retry(f"""
        CREATE TABLE IF NOT EXISTS posts_backup_{sanitized_dataset_id} AS
        SELECT * FROM posts WHERE dataset_id = ?
    """, (dataset_id,))

    # Create backup for comments
    execute_query_with_retry(f"""
        CREATE TABLE IF NOT EXISTS comments_backup_{sanitized_dataset_id} AS
        SELECT * FROM comments WHERE dataset_id = ?
    """, (dataset_id,))



@router.post("/apply-rules-to-dataset", response_model=dict)
def apply_rules_to_dataset(payload: DatasetRequest = Body(...)):
    """Process the dataset by applying all defined rules using multi-threading with minimal memory usage."""
    BATCH_SIZE = 100  # Define the size of each batch
    THREAD_COUNT = 8  # Define the total number of threads to use
    
    dataset_id = payload.dataset_id
    sanitized_dataset_id = dataset_id.replace("-", "_")
    
    # Create backup tables for posts and comments
    create_backup_table(dataset_id)

    # Fetch rules for the dataset
    rules = execute_query_with_retry("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))
    rules = [{"fields": r[3], "words": r[4], "pos": r[5], "action": r[6]} for r in rules]

    def process_batch(task):
        """Worker function to process a single task."""
        offset, is_posts = task
        table_name = f"posts_backup_{sanitized_dataset_id}" if is_posts else f"comments_backup_{sanitized_dataset_id}"
        try:
            with sqlite3.connect(DATABASE_PATH) as conn:
                cursor = conn.cursor()
                print(f"Processing batch at offset {offset} for {'posts' if is_posts else 'comments'}")
                
                # Fetch and process batch
                if is_posts:
                    cursor.execute(f"SELECT id, title, selftext FROM {table_name} LIMIT {BATCH_SIZE} OFFSET ?", (offset,))
                    batch_data = cursor.fetchall()
                    processed_data = [
                        (apply_rules_to_text(rules, row[1], dataset_id), apply_rules_to_text(rules, row[2], dataset_id), row[0])
                        for row in batch_data
                    ]
                    cursor.executemany(f"UPDATE {table_name} SET title = ?, selftext = ? WHERE id = ?", processed_data)
                else:
                    cursor.execute(f"SELECT id, body FROM {table_name} LIMIT {BATCH_SIZE} OFFSET ?", (offset,))
                    batch_data = cursor.fetchall()
                    processed_data = [
                        (apply_rules_to_text(rules, row[1], dataset_id), row[0])
                        for row in batch_data
                    ]
                    cursor.executemany(f"UPDATE {table_name} SET body = ? WHERE id = ?", processed_data)

                conn.commit()
            print(f"Processed batch at offset {offset} for {'posts' if is_posts else 'comments'}")
        except Exception as e:
            print(f"Error processing batch at offset {offset} for {'posts' if is_posts else 'comments'}: {e}")

    def prepare_tasks():
        """Prepare tasks for posts and comments processing."""
        tasks = []
        
        # Prepare tasks for posts
        table_name = f"posts_backup_{sanitized_dataset_id}"
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total_rows = cursor.fetchone()[0]
            tasks.extend([(offset, True) for offset in range(0, total_rows, BATCH_SIZE)])
        
        # Prepare tasks for comments
        table_name = f"comments_backup_{sanitized_dataset_id}"
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total_rows = cursor.fetchone()[0]
            tasks.extend([(offset, False) for offset in range(0, total_rows, BATCH_SIZE)])
        
        return tasks

    # Prepare tasks for posts and comments
    tasks = prepare_tasks()

    # Create a thread pool and process tasks
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=THREAD_COUNT) as executor:
        executor.map(process_batch, tasks)

    return {"message": "Rules applied successfully"}


# @router.post("/apply-rules-to-dataset", response_model=dict)
# def apply_rules_to_dataset(payload: DatasetRequest = Body(...)):
#     """Process the dataset by applying all defined rules using multi-threading with minimal memory usage."""
#     BATCH_SIZE = 100  # Define the size of each batch
#     THREAD_COUNT = 8  # Define the number of threads to use
    
#     dataset_id = payload.dataset_id
#     sanitized_dataset_id = dataset_id.replace("-", "_")
    
#     # Create backup tables for posts and comments
#     create_backup_table(dataset_id)

#     # Fetch rules for the dataset
#     rules = execute_query_with_retry("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))
#     rules = [{"fields": r[3], "words": r[4], "pos": r[5], "action": r[6]} for r in rules]

#     def process_batch(queue: Queue, is_posts: bool):
#         """Worker function to process batches."""
#         table_name = f"posts_backup_{sanitized_dataset_id}" if is_posts else f"comments_backup_{sanitized_dataset_id}"
#         while True:
#             offset = queue.get()
#             if offset is None:
#                 break  # No more tasks to process

#             try:
#                 with sqlite3.connect(DATABASE_PATH) as conn:
#                     cursor = conn.cursor()
#                     print(f"Processing batch at offset {offset} for {'posts' if is_posts else 'comments'}")
#                     # Fetch and process batch
#                     if is_posts:
#                         cursor.execute(f"SELECT id, title, selftext FROM {table_name} LIMIT {BATCH_SIZE} OFFSET ?", (offset,))
#                         batch_data = cursor.fetchall()
#                         # print("Data", batch_data)
#                         processed_data = [
#                             (apply_rules_to_text(rules, row[1], dataset_id), apply_rules_to_text(rules, row[2], dataset_id), row[0])
#                             for row in batch_data
#                         ]
#                         cursor.executemany(f"UPDATE {table_name} SET title = ?, selftext = ? WHERE id = ?", processed_data)
#                     else:
#                         cursor.execute(f"SELECT id, body FROM {table_name} LIMIT {BATCH_SIZE} OFFSET ?", (offset,))
#                         batch_data = cursor.fetchall()
#                         # print("Data", batch_data)
#                         processed_data = [
#                             (apply_rules_to_text(rules, row[1], dataset_id), row[0])
#                             for row in batch_data
#                         ]
#                         cursor.executemany(f"UPDATE {table_name} SET body = ? WHERE id = ?", processed_data)

#                     conn.commit()
#                 print(f"Processed batch at offset {offset} for {'posts' if is_posts else 'comments'}")
#             except Exception as e:
#                 print(f"Error processing batch at offset {offset}: {e}")
#             finally:
#                 queue.task_done()

#     def prepare_and_start_threads(is_posts: bool):
#         """Prepare threads for either posts or comments processing."""
#         table_name = f"posts_backup_{sanitized_dataset_id}" if is_posts else f"comments_backup_{sanitized_dataset_id}"

#         # Get the total row count
#         with sqlite3.connect(DATABASE_PATH) as conn:
#             cursor = conn.cursor()
#             cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
#             total_rows = cursor.fetchone()[0]

#         # Create task queue
#         queue = Queue()
#         for offset in range(0, total_rows, BATCH_SIZE):
#             queue.put(offset)

#         # Start threads
#         threads = []
#         for _ in range(THREAD_COUNT):
#             thread = threading.Thread(target=process_batch, args=(queue, is_posts))
#             thread.start()
#             threads.append(thread)

#         # Signal threads to stop
#         queue.join()
#         for _ in range(THREAD_COUNT):
#             queue.put(None)
#         for thread in threads:
#             thread.join()

#     # Process posts and comments concurrently
#     threads = [
#         threading.Thread(target=prepare_and_start_threads, args=(True,)),  # Posts
#         threading.Thread(target=prepare_and_start_threads, args=(False,))  # Comments
#     ]
#     for thread in threads:
#         thread.start()
#     for thread in threads:
#         thread.join()

#     return {"message": "Rules applied successfully"}


# Retrieve processed posts (Query Param)
@router.get("/datasets/processed-posts/{dataset_id}", response_model=dict)
def get_processed_posts(dataset_id: str):
    """Retrieve processed posts."""
    try:
        posts = execute_query(f"SELECT * FROM posts_backup_{dataset_id.replace('-', '_')} LIMIT 20 OFFSET 0", keys=True)
        return {"posts": [{"id": row["id"], "title": row["title"], "selftext": row["selftext"]} for row in posts]}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error fetching processed posts: {str(e)}")

# Retrieve processed comments (Query Param)
@router.get("/datasets/processed-comments/{dataset_id}", response_model=dict)
def get_processed_comments(dataset_id: str):
    """Retrieve processed comments."""
    try:
        comments = execute_query(f"SELECT * FROM comments_backup_{dataset_id.replace('-', '_')} LIMIT 20 OFFSET 0", keys=True)
        return {"comments": [{"id": row["id"], "body": row["body"]} for row in comments]}
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error fetching processed comments: {str(e)}")

@router.get("/datasets/included-words/{dataset_id}", response_model=dict)
def get_included_words(dataset_id: str):
    """Retrieve detailed included words (tokens) for a dataset."""
    try:
        result = execute_query(
            """
            SELECT token, pos, count_words, count_docs, tfidf_min, tfidf_max
            FROM token_stats_detailed
            WHERE dataset_id = ? AND status = 'included'
            ORDER BY count_words DESC
            """,
            (dataset_id,),
            keys=True
        )

        included_words = [
            {
                "token": row["token"],
                "pos": row["pos"],
                "count_words": row["count_words"],
                "count_docs": row["count_docs"],
                "tfidf_min": row["tfidf_min"],
                "tfidf_max": row["tfidf_max"]
            }
            for row in result
        ]

        return {"words": included_words}

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error fetching included words: {str(e)}")


@router.get("/datasets/removed-words/{dataset_id}", response_model=dict)
def get_excluded_words(dataset_id: str):
    """Retrieve detailed removed words (tokens) for a dataset."""
    try:
        result = execute_query(
            """
            SELECT token, pos, count_words, count_docs, tfidf_min, tfidf_max
            FROM token_stats_detailed
            WHERE dataset_id = ? AND status = 'removed'
            ORDER BY count_words DESC
            """,
            (dataset_id,),
            keys=True
        )

        excluded_words = [
            {
                "token": row["token"],
                "pos": row["pos"],
                "count_words": row["count_words"],
                "count_docs": row["count_docs"],
                "tfidf_min": row["tfidf_min"],
                "tfidf_max": row["tfidf_max"]
            }
            for row in result
        ]

        return {"words": excluded_words}

    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=f"Error fetching removed words: {str(e)}")



# from enum import Enum
# import sqlite3
# from typing import Any, Dict, List, Optional
# from fastapi import APIRouter, HTTPException
# from pydantic import BaseModel, Field
# from constants import DATABASE_PATH
# from routes.collection_routes import run_query_with_columns
# from services.token_filtering_service import token_filtering_service
# from models import Rule
# import spacy

# nlp = spacy.load("en_core_web_sm")

# router = APIRouter()

# # # Pydantic Model
# # Define possible actions
# class Action(str, Enum):
#     REMOVE = "Remove"
#     INCLUDE = "Include"

# # Define Rule model
# class Rule(BaseModel):
#     id: Optional[int] = Field(None, description="Unique ID of the rule")
#     datasetId: str = Field(..., description="UUID of the dataset")
#     step: int = Field(..., ge=1, description="Step number, must be greater than or equal to 1")
#     fields: str = Field(..., description="Field to apply the rule to")
#     words: str = Field(..., min_length=1, description="Word(s) to match for the rule")
#     pos: Optional[str] = Field(None, description="Optional Part-of-Speech (POS) tag to match")
#     action: Action = Field(..., description="Action to take on the matched tokens")


# def execute_query(query: str, params: tuple = ()) -> List[tuple]:
#     """Execute a SQL query and return the results."""
#     with sqlite3.connect(DATABASE_PATH) as conn:
#         cursor = conn.cursor()
#         cursor.execute(query, params)
#         conn.commit()
#         return cursor.fetchall()

# def create_backup_tables(dataset_id: str = Depends(get_dataset_id)):
#     """
#     Create backup tables for posts and comments for the given dataset.
#     """
#     with sqlite3.connect(DATABASE_PATH) as conn:
#         cursor = conn.cursor()

#         # Create backup for posts
#         cursor.execute(f"""
#             CREATE TABLE IF NOT EXISTS posts_backup_{dataset_id} AS
#             SELECT * FROM posts WHERE dataset_id = ?
#         """, (dataset_id,))

#         # Create backup for comments
#         cursor.execute(f"""
#             CREATE TABLE IF NOT EXISTS comments_backup_{dataset_id} AS
#             SELECT * FROM comments WHERE dataset_id = ?
#         """, (dataset_id,))

#         conn.commit()



# @router.on_event("startup")
# def initialize_database():
#     """Ensure the database and table exist."""
#     execute_query("""
#         CREATE TABLE IF NOT EXISTS rules (
#             id INTEGER PRIMARY KEY AUTOINCREMENT,
#             dataset_id INTEGER NOT NULL,
#             step INTEGER NOT NULL,
#             fields TEXT NOT NULL,
#             words TEXT NOT NULL,
#             pos TEXT,
#             action TEXT NOT NULL
#         );
#     """)


# def apply_rules_to_backup(dataset_id: str = Depends(get_dataset_id), rules: List[Dict[str, Any]]):
#     """
#     Apply rules to the backup tables.
#     """
#     with sqlite3.connect(DATABASE_PATH) as conn:
#         conn.row_factory = sqlite3.Row
#         cursor = conn.cursor()

#         # Fetch posts and comments from backups
#         posts = cursor.execute(f"""
#             SELECT id, title, selftext FROM posts_backup_{dataset_id}
#         """).fetchall()
#         comments = cursor.execute(f"""
#             SELECT id, body FROM comments_backup_{dataset_id}
#         """).fetchall()

#         # Apply rules to posts
#         for post in posts:
#             updated_title = apply_rules_to_text(rules, post["title"], "title")
#             updated_selftext = apply_rules_to_text(rules, post["selftext"], "selftext")
#             cursor.execute(f"""
#                 UPDATE posts_backup_{dataset_id}
#                 SET title = ?, selftext = ?
#                 WHERE id = ?
#             """, (updated_title, updated_selftext, post["id"]))

#         # Apply rules to comments
#         for comment in comments:
#             updated_body = apply_rules_to_text(rules, comment["body"], "body")
#             cursor.execute(f"""
#                 UPDATE comments_backup_{dataset_id}
#                 SET body = ?
#                 WHERE id = ?
#             """, (updated_body, comment["id"]))

#         conn.commit()


# def apply_rules_to_text(rules: List[Dict[str, Any]], text: str, field: str) -> str:
#     """
#     Apply rules to a given text field.
#     - Tokenize the text with spaCy.
#     - Apply rules based on matching conditions.
#     """
#     doc = nlp(text)
#     tokens = []
#     for token in doc:
#         token_data = {
#             "text": token.text,
#             "pos": token.pos_,
#             "lemma": token.lemma_,
#             "is_stop": token.is_stop,
#         }
#         tokens.append(token_data)

#     # Apply rules
#     for rule in rules:
#         if rule["fields"] != "<ANY>" and rule["fields"] != field:
#             continue  # Skip if rule is not for this field
#         for token in tokens:
#             if rule["words"] == "<ANY>" or rule["words"] == token["text"]:
#                 if rule["pos"] is None or rule["pos"] == token["pos"]:
#                     token["action"] = rule["action"]

#     # Reconstruct text after applying rules
#     return " ".join([t["text"] for t in tokens if t.get("action") != "Remove"])



# @router.get("/datasets/{dataset_id}/rules", response_model=List[Rule])
# def get_rules(dataset_id: str = Depends(get_dataset_id)):
#     """Fetch all rules for a dataset."""
#     rows = execute_query("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))
#     return [Rule(id=row[0], dataset_id=row[1], step=row[2], fields=row[3], words=row[4], pos=row[5], action=row[6]) for row in rows]


# @router.post("/datasets/{dataset_id}/rules")
# def add_or_update_rules(dataset_id: str = Depends(get_dataset_id), rules: List[Rule]):
#     """Add or replace rules for a dataset."""
#     # Remove existing rules for the dataset
#     execute_query("DELETE FROM rules WHERE dataset_id = ?", (dataset_id,))

#     # Insert new rules
#     for rule in rules:
#         execute_query(
#             """
#             INSERT INTO rules (dataset_id, step, fields, words, pos, action)
#             VALUES (?, ?, ?, ?, ?, ?)
#             """,
#             (rule.dataset_id, rule.step, rule.fields, rule.words, rule.pos, rule.action)
#         )
#     return {"success": True, "updated_count": len(rules)}


# @router.delete("/datasets/{dataset_id}/rules")
# def delete_all_rules(dataset_id: str = Depends(get_dataset_id)):
#     """Delete all rules for a dataset."""
#     execute_query("DELETE FROM rules WHERE dataset_id = ?", (dataset_id,))
#     return {"success": True, "message": "All rules deleted"}


# @router.delete("/datasets/{dataset_id}/rules/{rule_id}")
# def delete_rule(dataset_id: str = Depends(get_dataset_id), rule_id: int):
#     """Delete a specific rule by ID."""
#     rows = execute_query("DELETE FROM rules WHERE dataset_id = ? AND id = ?", (dataset_id, rule_id))
#     if rows:
#         return {"success": True, "message": "Rule deleted"}
#     raise HTTPException(status_code=404, detail="Rule not found")

# @router.post("/apply-rules-to-dataset")
# async def apply_rules_to_dataset(dataset_id: str = Depends(get_dataset_id)):
#     """
#     Apply rules to posts and comments of a dataset.
#     - Create backup tables for the dataset.
#     - Fetch rules and apply them to the backups.
#     """
#     try:
#         # Create backup tables
#         create_backup_tables(dataset_id)

#         # Fetch rules for the dataset
#         rules = run_query_with_columns("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))

#         # Apply rules to backup data
#         apply_rules_to_backup(dataset_id, rules)

#         return {"message": "Rules applied successfully to the dataset backups"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error processing dataset: {str(e)}")

# @router.get("/processed-posts/{dataset_id}")
# def get_processed_posts(dataset_id: str = Depends(get_dataset_id)):
#     """
#     Retrieve processed posts from the backup table.
#     """
#     try:
#         processed_posts = run_query_with_columns(f"""
#             SELECT * FROM posts_backup_{dataset_id}
#         """)
#         return {"posts": processed_posts}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error fetching processed posts: {str(e)}")


# @router.get("/processed-comments/{dataset_id}")
# def get_processed_comments(dataset_id: str = Depends(get_dataset_id)):
#     """
#     Retrieve processed comments from the backup table.
#     """
#     try:
#         processed_comments = run_query_with_columns(f"""
#             SELECT * FROM comments_backup_{dataset_id}
#         """)
#         return {"comments": processed_comments}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error fetching processed comments: {str(e)}")


# @router.post("/apply-rules")
# def apply_rules(dataset_id: str = Depends(get_dataset_id), text: str):
#     """Apply rules to a given text."""
#     # Fetch rules for the dataset
#     rules = get_rules(dataset_id)

#     # Process text using spaCy
#     doc = nlp(text)
#     tokens = []
#     for token in doc:
#         token_data = {
#             "text": token.text,
#             "pos": token.pos_,
#             "lemma": token.lemma_,
#             "is_stop": token.is_stop,
#         }
#         tokens.append(token_data)

#     # Apply rules
#     for rule in rules:
#         if rule.fields == "<ANY>" or rule.fields in [t["text"] for t in tokens]:
#             for token in tokens:
#                 if rule.words == "<ANY>" or rule.words == token["text"]:
#                     if rule.pos is None or rule.pos == token["pos"]:
#                         token["action"] = rule.action

#     return tokens
# # @router.get("/datasets")
# # def list_datasets():
# #     return list_datasets()


# # @router.get("/datasets/{dataset_id}/rules")
# # def get_rules(dataset_id: str = Depends(get_dataset_id)):
# #     try:
# #         return get_filter_rules(dataset_id)
# #     except ValueError as e:
# #         raise HTTPException(status_code=404, detail=str(e))


# # @router.post("/datasets/{dataset_id}/rules")
# # def apply_rules(dataset_id: str = Depends(get_dataset_id), rules: List[Rule]):
# #     try:
# #         return apply_filter_rules(dataset_id, [rule.dict() for rule in rules])
# #     except ValueError as e:
# #         raise HTTPException(status_code=404, detail=str(e))


# # @router.post("/rules/save")
# # def save_rules(data: dict):
# #     return save_filter_rules(data)


# # @router.post("/rules/load")
# # def load_rules(data: dict):
# #     return load_filter_rules(data)
