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
import re
from sklearn.feature_extraction.text import TfidfVectorizer

from constants import DATABASE_PATH
from utils.db_helpers import execute_query, execute_query_with_retry

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
# nlp = spacy.load(model_path)
router = APIRouter()

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
    

def fetch_rules_for_dataset(dataset_id: str) -> List[Dict[str, Any]]:
    """
    Fetch rules from the database for a specific dataset.
    """
    query = "SELECT fields, words, pos, action FROM rules WHERE dataset_id = ?"
    rules = execute_query(query, (dataset_id,), keys = True)
    return [{"fields": rule["fields"], "words": rule["words"], "pos": rule["pos"], "action": rule["action"]} for rule in rules]

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
        SELECT id, title || ' ' || selftext AS content
        FROM posts_backup_{sanitized_id}
        UNION ALL
        SELECT id, body AS content
        FROM comments_backup_{sanitized_id};
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
        nlp = spacy.load(model_path)
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
        execute_query_with_retry(f"DROP TABLE IF EXISTS {temp_table};")
        cleanup_temp_tables(dataset_id)
        # pass

    return {"message": "Rules applied successfully"}


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
        result = execute_query(query, (dataset_id,), keys = True)
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
        result = execute_query(query, (dataset_id,), keys = True)
        return {"words": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching removed words: {str(e)}")
