from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import math
from pathlib import Path
import random
import sqlite3
import time
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, HTTPException, Path, Query, Body
from pydantic import BaseModel
import spacy
import sys
import os
from sklearn.feature_extraction.text import TfidfVectorizer

from constants import DATABASE_PATH

class DatasetIdRequest(BaseModel):
    """Request model to handle dataset_id in the body."""
    dataset_id: str

class DatasetTokenRequest(BaseModel):
    """Request model for including tokens."""
    dataset_id: str
    tokens: Optional[List[str]] = None

class RulesRequest(BaseModel):
    """Request model for adding or fetching rules."""
    dataset_id: str
    rules: Optional[List[dict]] = None

class ProcessBatchRequest(BaseModel):
    """Request model for applying rules to the dataset."""
    dataset_id: str
    batch_size: Optional[int] = 100
    thread_count: Optional[int] = 8

# Initialize FastAPI and spaCy
# Check if running inside PyInstaller bundle
if hasattr(sys, '_MEIPASS'):
    model_path = os.path.join(sys._MEIPASS, 'spacy/data/en_core_web_sm')
else:
    model_path = 'en_core_web_sm'  # Fallback for normal execution

# Load the spaCy model
nlp = spacy.load(model_path)
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
@router.post("/datasets/rules", response_model=List[Rule])
def get_rules(payload: DatasetIdRequest):
    """Fetch rules for a dataset."""
    dataset_id = payload.dataset_id
    if dataset_id is None:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    rows = execute_query("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))
    return [
        Rule(id=row[0], step=row[2], fields=row[3], words=row[4], pos=row[5], action=row[6])
        for row in rows
    ]


# Add or replace rules (Body Param)
@router.post("/datasets/add-rules", response_model=dict)
def add_rules(payload: RulesRequest):
    """Add or replace rules for a dataset."""
    dataset_id = payload.dataset_id
    if dataset_id is None:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    rules = payload.rules or []
    execute_query("DELETE FROM rules WHERE dataset_id = ?", (dataset_id,))
    for rule in rules:
        execute_query("""
            INSERT INTO rules (dataset_id, step, fields, words, pos, action)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (dataset_id, rule["step"], rule["fields"], rule["words"], rule.get("pos"), rule["action"]))
    return {"message": "Rules added successfully"}


# Delete all rules for a dataset (Path Param)
@router.post("/datasets/delete-rules", response_model=dict)
def delete_all_rules(payload: DatasetIdRequest):
    """Delete all rules for a dataset."""
    dataset_id = payload.dataset_id
    if dataset_id is None:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
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

import re

# Utilities
def fetch_query_as_dict(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    

def fetch_rules_for_dataset(dataset_id: str) -> List[Dict[str, Any]]:
    """
    Fetch rules from the database for a specific dataset.
    """
    query = "SELECT fields, words, pos, action FROM rules WHERE dataset_id = ?"
    rules = fetch_query_as_dict(query, (dataset_id,))
    return [{"fields": rule["fields"], "words": rule["words"], "pos": rule["pos"], "action": rule["action"]} for rule in rules]

def execute_query_with_retry(query: str, params: tuple = (), retries: int = 5, backoff: float = 0.1):
    for attempt in range(retries):
        try:
            with sqlite3.connect(DATABASE_PATH) as conn:
                sqlite3.threadsafety = 1
                conn.execute("BEGIN")
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                return cursor.fetchall()
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e).lower() and attempt < retries - 1:
                time.sleep(backoff * (2 ** attempt) + random.uniform(0, 0.05))
            else:
                raise Exception(f"Database operation failed after {retries} attempts: {e}")
        except Exception as e:
            conn.rollback()
            raise

def cleanup_temp_tables(dataset_id: str):
    sanitized_id = dataset_id.replace("-", "_")
    temp_tables = [f"tokens_{sanitized_id}", f"tfidf_{sanitized_id}"]
    for table in temp_tables:
        execute_query_with_retry(f"DROP TABLE IF EXISTS {table};")

# Utilities
def clean_text(text: str) -> str:
    text = re.sub(r'[^\w\s]', '', text)
    return text.strip() if len(text.strip()) > 2 else ""


def filter_tokens(doc) -> List[Dict[str, Any]]:
    """
    Filter tokens to include all alphanumeric tokens, emojis, and meaningful symbols.
    """
    tokens = []
    for token in doc:
        token_data = {"text": token.text, "pos": token.pos_}
        tokens.append(token_data)
    # Debugging: Log the filtered tokens
    print(f"Filtered tokens: {tokens[:10]}")  # Show the first 10 tokens for debugging
    return tokens



def create_backup_tables(dataset_id: str):
    sanitized_id = dataset_id.replace("-", "_")
    queries = [
        f"CREATE TABLE IF NOT EXISTS posts_backup_{sanitized_id} AS SELECT * FROM posts WHERE dataset_id = ?;",
        f"CREATE TABLE IF NOT EXISTS comments_backup_{sanitized_id} AS SELECT * FROM comments WHERE dataset_id = ?;"
    ]
    for query in queries:
        execute_query_with_retry(query, (dataset_id,))


def create_token_table(dataset_id: str):
    """
    Create the token table with doc_id, token, pos, and count columns.
    """
    sanitized_id = dataset_id.replace("-", "_")
    table_name = f"tokens_{sanitized_id}"
    query = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            doc_id TEXT,
            token TEXT,
            pos TEXT,
            count INTEGER,
            PRIMARY KEY (doc_id, token, pos)
        );
    """
    execute_query_with_retry(query)
    return table_name



def populate_token_table_parallel(dataset_id: str, batch_size: int, table_name: str):
    """
    Populate the token table with preprocessed tokens using parallel processing.
    """
    sanitized_id = dataset_id.replace("-", "_")
    query = f"""
        SELECT id, selftext FROM posts_backup_{sanitized_id}
        UNION ALL
        SELECT id, body FROM comments_backup_{sanitized_id};
    """

    nlp = spacy.load("en_core_web_sm")
    for component in ["ner", "textcat"]:
        if component in nlp.pipe_names:
            nlp.disable_pipes(component)

    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(query)

        with ThreadPoolExecutor() as executor:
            while True:
                rows = cursor.fetchmany(batch_size)
                if not rows:
                    break

                # Process rows in parallel
                future = executor.submit(process_documents, rows)
                tokens = future.result()  # Retrieve processed tokens
                insert_tokens(cursor, table_name, tokens)  # Insert into the database

        conn.commit()


def compute_global_tfidf_from_table(dataset_id: str, token_table: str):
    """
    Compute global TF-IDF scores from the token table and store results in another table.
    """
    sanitized_id = dataset_id.replace("-", "_")
    tfidf_table = f"tfidf_{sanitized_id}"
    doc_frequency_table = f"doc_frequency_{sanitized_id}"
    tfidf_per_doc_table = f"tfidf_per_doc_{sanitized_id}"

    # Create the TF-IDF table
    execute_query_with_retry(f"""
        CREATE TABLE IF NOT EXISTS {tfidf_table} (
            token TEXT PRIMARY KEY,
            tfidf_min REAL,
            tfidf_max REAL
        );
    """)

    # Step 1: Create the doc_frequency table
    execute_query_with_retry(f"""
        CREATE TABLE IF NOT EXISTS {doc_frequency_table} AS
        SELECT 
            token,
            COUNT(DISTINCT doc_id) AS doc_frequency
        FROM {token_table}
        GROUP BY token;
    """)

    # Step 2: Create the tfidf_per_doc table
    total_docs_query = f"SELECT COUNT(DISTINCT doc_id) FROM {token_table};"
    total_docs = execute_query_with_retry(total_docs_query)[0][0]

    execute_query_with_retry(f"""
        CREATE TABLE IF NOT EXISTS {tfidf_per_doc_table} AS
        SELECT 
            t.token,
            t.doc_id,
            SUM(t.count) AS term_frequency,
            SUM(t.count) * LOG(1 + {total_docs} / (1 + df.doc_frequency)) AS doc_tfidf
        FROM {token_table} t
        JOIN {doc_frequency_table} df ON t.token = df.token
        GROUP BY t.token, t.doc_id;
    """)

    # Step 3: Compute tfidf_min and tfidf_max and insert into the tfidf table
    execute_query_with_retry(f"""
        INSERT OR REPLACE INTO {tfidf_table}
        SELECT 
            token,
            MIN(doc_tfidf) AS tfidf_min,
            MAX(doc_tfidf) AS tfidf_max
        FROM {tfidf_per_doc_table}
        GROUP BY token;
    """)

    # Cleanup intermediate tables
    print("Cleaning up intermediate tables...")
    execute_query_with_retry(f"DROP TABLE IF EXISTS {doc_frequency_table};")
    execute_query_with_retry(f"DROP TABLE IF EXISTS {tfidf_per_doc_table};")

    return tfidf_table




def process_documents(rows):
    tokens = []
    for doc_id, raw_text in rows:
        if not raw_text.strip():
            continue
        doc = nlp(re.sub(r'\s+', ' ', raw_text.strip()))
        token_counts = defaultdict(int)
        for token in filter_tokens(doc):
            key = (token["text"], token["pos"])
            token_counts[key] += 1
        for (text, pos), count in token_counts.items():
            tokens.append({"doc_id": doc_id, "token": text, "pos": pos, "count": count})
    return tokens



def insert_tokens(cursor, table_name: str, tokens: List[Dict[str, Any]]):
    """
    Insert tokens with counts into the token table.
    """
    if not tokens:
        return

    valid_tokens = [
        token for token in tokens
        if all(key in token for key in ["doc_id", "token", "pos", "count"])
    ]

    cursor.executemany(
        f"""
        INSERT OR IGNORE INTO {table_name} (doc_id, token, pos, count)
        VALUES (:doc_id, :token, :pos, :count);
        """,
        valid_tokens
    )


def apply_rule(rule, dataset_id, token_table, tfidf_table, temp_table):
    """
    Apply a single rule to the dataset and insert results into the intermediate table.
    """
    token_condition = f"token = '{rule['words']}'" if rule["words"] != "<ANY>" else "1=1"
    pos_condition = f"pos = '{rule['pos']}'" if rule["pos"] else "1=1"
    status = 'removed' if rule["action"] == "Remove" else 'included'

    query = f"""
        INSERT INTO {temp_table}
        SELECT 
            '{dataset_id}' AS dataset_id,
            token,
            pos,
            SUM(count) AS count_words,
            COUNT(DISTINCT doc_id) AS count_docs,
            MIN(tfidf_min) AS tfidf_min,
            MAX(tfidf_max) AS tfidf_max,
            '{status}' AS status
        FROM {token_table}
        LEFT JOIN {tfidf_table} USING (token)
        WHERE {token_condition} AND {pos_condition}
        GROUP BY token, pos;
    """
    execute_query_with_retry(query)


def add_remaining_tokens(dataset_id, token_table, tfidf_table, temp_table):
    """
    Ensure all tokens are added to temp_table with a default 'included' status.
    """
    query = f"""
        INSERT INTO {temp_table}
        SELECT 
            '{dataset_id}' AS dataset_id,
            token,
            pos,
            SUM(count) AS count_words,
            COUNT(DISTINCT doc_id) AS count_docs,
            MIN(tfidf_min) AS tfidf_min,
            MAX(tfidf_max) AS tfidf_max,
            'included' AS status
        FROM {token_table}
        LEFT JOIN {tfidf_table} USING (token)
        WHERE token NOT IN (SELECT DISTINCT token FROM {temp_table})
        GROUP BY token, pos;
    """
    execute_query_with_retry(query)







def apply_rules_to_tokens_parallel(dataset_id, token_table, tfidf_table, temp_table, rules, thread_count):
    """
    Apply rules to tokens in parallel and ensure all tokens are included in the temp table.
    """
    # Parallel rule application
    with ThreadPoolExecutor(max_workers=thread_count) as executor:
        futures = [
            executor.submit(apply_rule, rule, dataset_id, token_table, tfidf_table, temp_table)
            for rule in rules
        ]
        for future in futures:
            future.result()  # Ensure all threads complete

    # Add remaining tokens with default 'included' status
    print("Adding remaining tokens...")
    add_remaining_tokens(dataset_id, token_table, tfidf_table, temp_table)



@router.post("/datasets/apply-rules", response_model=dict)
def apply_rules_to_dataset_parallel(payload: Dict[str, Any]):
    dataset_id = payload.get("dataset_id")
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")

    BATCH_SIZE = 1000
    THREAD_COUNT = os.cpu_count() - 2

    try:
        sanitized_id = dataset_id.replace("-", "_")
        temp_table = f"temp_token_stats_{sanitized_id}"  

        create_backup_tables(dataset_id)

        token_table = create_token_table(dataset_id)

        populate_token_table_parallel(dataset_id, BATCH_SIZE, token_table)

        tfidf_table = compute_global_tfidf_from_table(dataset_id, token_table)

        # execute_query_with_retry(f"""
        #     CREATE TABLE IF NOT EXISTS {temp_table} (
        #         dataset_id TEXT,
        #         token TEXT,
        #         pos TEXT,
        #         count_words INTEGER,
        #         count_docs INTEGER,
        #         tfidf_min REAL,
        #         tfidf_max REAL,
        #         status TEXT
        #     );
        # """)

        # rules = fetch_rules_for_dataset(dataset_id)
        # if not rules:
        #     raise ValueError(f"No rules found for dataset {dataset_id}")

        execute_query_with_retry(f"""
            CREATE TABLE IF NOT EXISTS {temp_table} (
                dataset_id TEXT,
                token TEXT,
                pos TEXT,
                count_words INTEGER,
                count_docs INTEGER,
                tfidf_min REAL,
                tfidf_max REAL,
                status TEXT
            );
        """)

        # Step 5: Apply rules in parallel
        print("Applying rules in parallel...")
        rules = fetch_rules_for_dataset(dataset_id)
        if not rules:
            raise ValueError(f"No rules found for dataset {dataset_id}")

        apply_rules_to_tokens_parallel(dataset_id, token_table, tfidf_table, temp_table, rules, THREAD_COUNT)

        # Merge final results into the detailed stats table
        print("Merging results into token_stats_detailed...")
        final_merge_query = f"""
            INSERT OR REPLACE INTO token_stats_detailed
            SELECT 
                dataset_id,
                token,
                pos,
                SUM(count_words) AS count_words,
                SUM(count_docs) AS count_docs,
                MIN(tfidf_min) AS tfidf_min,
                MAX(tfidf_max) AS tfidf_max,
                CASE 
                    WHEN SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END) > 0 THEN 'removed'
                    ELSE 'included'
                END AS status
            FROM {temp_table}
            GROUP BY dataset_id, token, pos;
        """
        execute_query_with_retry(final_merge_query)





    except Exception as e:
        print(f"Error applying rules to dataset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # execute_query_with_retry(f"DROP TABLE IF EXISTS {temp_table};")
        # cleanup_temp_tables(dataset_id)
        pass

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
@router.post("/datasets/processed-posts")
def get_processed_posts(payload: DatasetIdRequest):
    """Retrieve processed posts."""
    if payload.dataset_id is None:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        dataset_id = payload.dataset_id
        posts = execute_query(f"SELECT COUNT(*) from posts where dataset_id = ?", (dataset_id,))
        return posts[0][0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching processed posts: {str(e)}")

# Retrieve processed comments (Query Param)
@router.post("/datasets/processed-comments")
def get_processed_comments(payload: DatasetIdRequest):
    """Retrieve processed comments."""
    if payload.dataset_id is None:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        dataset_id = payload.dataset_id
        comments = execute_query(f"SELECT COUNT(*) FROM comments where dataset_id = ?", (dataset_id,))
        return comments[0][0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching processed comments: {str(e)}")

@router.post("/datasets/included-words", response_model=dict)
def get_included_words(payload: DatasetIdRequest):
    """Retrieve included words for a dataset."""
    dataset_id = payload.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        query = """
        SELECT token, pos, count_words, count_docs, tfidf_min, tfidf_max
        FROM token_stats_detailed
        WHERE dataset_id = ? AND status = 'included'
        ORDER BY count_words DESC;
        """
        result = fetch_query_as_dict(query, (dataset_id,))
        return {"words": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching included words: {str(e)}")




@router.post("/datasets/removed-words", response_model=dict)
def get_removed_words(payload: DatasetIdRequest):
    """Retrieve excluded words for a dataset."""
    dataset_id = payload.dataset_id
    if not dataset_id:
        raise HTTPException(status_code=400, detail="Dataset ID is required.")
    try:
        query = """
        SELECT token, pos, count_words, count_docs, tfidf_min, tfidf_max
        FROM token_stats_detailed
        WHERE dataset_id = ? AND status = 'removed'
        ORDER BY count_words DESC;
        """
        result = fetch_query_as_dict(query, (dataset_id,))
        return {"words": result}
    except Exception as e:
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
