from concurrent.futures import ThreadPoolExecutor
import re
from typing import Any, Dict, List
from uuid import uuid4

from attr import asdict
from database import RulesRepository, PostsRepository, CommentsRepository, TokensRepository
from models import Rule


rules_repo = RulesRepository()

def get_rules_for_dataset(dataset_id: str):
    """Retrieve rules for a dataset."""
    return rules_repo.find({"dataset_id": dataset_id})


def add_rules_to_dataset(dataset_id: str, rules: list):
    """Add rules to a dataset."""
    for rule in rules:
        new_id = str(uuid4())
        print("new_id", new_id, rule)
        del rule["id"]
        rules_repo.insert(Rule(**rule, dataset_id=dataset_id, id=new_id))
    return {"message": "Rules added successfully"}

def update_rule(dataset_id: str, rule_id: str, **kwargs):
    """Update a rule."""
    rules_repo.update({"dataset_id": dataset_id, "id": rule_id}, kwargs)
    return {"message": "Rule updated successfully"}

def delete_rule(dataset_id: str, rule_id: str):
    """Delete a rule."""
    rules_repo.delete({"dataset_id": dataset_id, "id": rule_id})
    return {"message": "Rule deleted successfully"}

def delete_rules_for_dataset(dataset_id: str):
    """Delete all rules for a dataset."""
    rules_repo.delete({"dataset_id": dataset_id})
    return {"message": "All rules deleted successfully"}


def backup_post_table(dataset_id: str):
    """Backup the post table for a dataset."""
    post_repo = PostsRepository()
    post_repo.backup_table({"dataset_id": dataset_id})
    return {"message": "Post table backed up successfully"}

def backup_comment_table(dataset_id: str):
    """Backup the comment table for a dataset."""
    comment_repo = CommentsRepository()
    comment_repo.backup_table({"dataset_id": dataset_id})
    return {"message": "Comment table backed up successfully"}



def fetch_rules_for_dataset(dataset_id: str) -> List[Dict[str, Any]]:
    """
    Fetch rules from the database for a specific dataset.
    """
    rules = rules_repo.find(filters={"dataset_id": dataset_id}, columns=["fields", "words", "pos", "action"])
    return [asdict(rule) for rule in rules]


def cleanup_temp_tables(dataset_id: str):
    sanitized_id = dataset_id.replace("-", "_")
    
    f"tfidf_{sanitized_id}"
    TokensRepository(dataset_id).drop_table()
    


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



# def create_backup_tables(dataset_id: str):
#     sanitized_id = dataset_id.replace("-", "_")
#     queries = [
#         f"CREATE TABLE IF NOT EXISTS posts_backup_{sanitized_id} AS SELECT * FROM posts WHERE dataset_id = ?;",
#         f"CREATE TABLE IF NOT EXISTS comments_backup_{sanitized_id} AS SELECT * FROM comments WHERE dataset_id = ?;"
#     ]
#     for query in queries:
#         execute_query_with_retry(query, (dataset_id,))


# def create_token_table(dataset_id: str):
#     """
#     Create the token table with doc_id, token, pos, and count columns.
#     """
#     sanitized_id = dataset_id.replace("-", "_")
#     table_name = f"tokens_{sanitized_id}"
#     query = f"""
#         CREATE TABLE IF NOT EXISTS {table_name} (
#             doc_id TEXT,
#             token TEXT,
#             pos TEXT,
#             count INTEGER,
#             PRIMARY KEY (doc_id, token, pos)
#         );
#     """
#     execute_query_with_retry(query)
#     return table_name



# def populate_token_table_parallel(dataset_id: str, batch_size: int, table_name: str):
#     """
#     Populate the token table with preprocessed tokens using parallel processing.
#     """
#     sanitized_id = dataset_id.replace("-", "_")
#     query = f"""
#         SELECT id, title || ' ' || selftext AS content
#         FROM posts_backup_{sanitized_id}
#         UNION ALL
#         SELECT id, body AS content
#         FROM comments_backup_{sanitized_id};
#     """

#     nlp = spacy.load("en_core_web_sm")
#     for component in ["ner", "textcat"]:
#         if component in nlp.pipe_names:
#             nlp.disable_pipes(component)

#     with sqlite3.connect(DATABASE_PATH) as conn:
#         cursor = conn.cursor()
#         cursor.execute(query)

#         with ThreadPoolExecutor() as executor:
#             while True:
#                 rows = cursor.fetchmany(batch_size)
#                 if not rows:
#                     break

#                 # Process rows in parallel
#                 future = executor.submit(process_documents, rows)
#                 tokens = future.result()  # Retrieve processed tokens
#                 insert_tokens(cursor, table_name, tokens)  # Insert into the database

#         conn.commit()


# def compute_global_tfidf_from_table(dataset_id: str, token_table: str):
#     """
#     Compute global TF-IDF scores from the token table and store results in another table.
#     """
#     sanitized_id = dataset_id.replace("-", "_")
#     tfidf_table = f"tfidf_{sanitized_id}"
#     doc_frequency_table = f"doc_frequency_{sanitized_id}"
#     tfidf_per_doc_table = f"tfidf_per_doc_{sanitized_id}"

#     # Create the TF-IDF table
#     execute_query_with_retry(f"""
#         CREATE TABLE IF NOT EXISTS {tfidf_table} (
#             token TEXT PRIMARY KEY,
#             tfidf_min REAL,
#             tfidf_max REAL
#         );
#     """)

#     # Step 1: Create the doc_frequency table
#     execute_query_with_retry(f"""
#         CREATE TABLE IF NOT EXISTS {doc_frequency_table} AS
#         SELECT 
#             token,
#             COUNT(DISTINCT doc_id) AS doc_frequency
#         FROM {token_table}
#         GROUP BY token;
#     """)

#     # Step 2: Create the tfidf_per_doc table
#     total_docs_query = f"SELECT COUNT(DISTINCT doc_id) FROM {token_table};"
#     total_docs = execute_query_with_retry(total_docs_query)[0][0]

#     execute_query_with_retry(f"""
#         CREATE TABLE IF NOT EXISTS {tfidf_per_doc_table} AS
#         SELECT 
#             t.token,
#             t.doc_id,
#             SUM(t.count) AS term_frequency,
#             SUM(t.count) * LOG(1 + {total_docs} / (1 + df.doc_frequency)) AS doc_tfidf
#         FROM {token_table} t
#         JOIN {doc_frequency_table} df ON t.token = df.token
#         GROUP BY t.token, t.doc_id;
#     """)

#     # Step 3: Compute tfidf_min and tfidf_max and insert into the tfidf table
#     execute_query_with_retry(f"""
#         INSERT OR REPLACE INTO {tfidf_table}
#         SELECT 
#             token,
#             MIN(doc_tfidf) AS tfidf_min,
#             MAX(doc_tfidf) AS tfidf_max
#         FROM {tfidf_per_doc_table}
#         GROUP BY token;
#     """)

#     # Cleanup intermediate tables
#     print("Cleaning up intermediate tables...")
#     execute_query_with_retry(f"DROP TABLE IF EXISTS {doc_frequency_table};")
#     execute_query_with_retry(f"DROP TABLE IF EXISTS {tfidf_per_doc_table};")

#     return tfidf_table




# def process_documents(rows):
#     tokens = []
#     for doc_id, raw_text in rows:
#         if not raw_text.strip():
#             continue
#         nlp = spacy.load(model_path)
#         doc = nlp(re.sub(r'\s+', ' ', raw_text.strip()))
#         token_counts = defaultdict(int)
#         for token in filter_tokens(doc):
#             key = (token["text"], token["pos"])
#             token_counts[key] += 1
#         for (text, pos), count in token_counts.items():
#             tokens.append({"doc_id": doc_id, "token": text, "pos": pos, "count": count})
#     return tokens



# def insert_tokens(cursor, table_name: str, tokens: List[Dict[str, Any]]):
#     """
#     Insert tokens with counts into the token table.
#     """
#     if not tokens:
#         return

#     valid_tokens = [
#         token for token in tokens
#         if all(key in token for key in ["doc_id", "token", "pos", "count"])
#     ]

#     cursor.executemany(
#         f"""
#         INSERT OR IGNORE INTO {table_name} (doc_id, token, pos, count)
#         VALUES (:doc_id, :token, :pos, :count);
#         """,
#         valid_tokens
#     )


# def apply_rule(rule, dataset_id, token_table, tfidf_table, temp_table):
#     """
#     Apply a single rule to the dataset and insert results into the intermediate table.
#     """
#     token_condition = f"token = '{rule['words']}'" if rule["words"] != "<ANY>" else "1=1"
#     pos_condition = f"pos = '{rule['pos']}'" if rule["pos"] else "1=1"
#     status = 'removed' if rule["action"] == "Remove" else 'included'

#     query = f"""
#         INSERT INTO {temp_table}
#         SELECT 
#             '{dataset_id}' AS dataset_id,
#             token,
#             pos,
#             SUM(count) AS count_words,
#             COUNT(DISTINCT doc_id) AS count_docs,
#             MIN(tfidf_min) AS tfidf_min,
#             MAX(tfidf_max) AS tfidf_max,
#             '{status}' AS status
#         FROM {token_table}
#         LEFT JOIN {tfidf_table} USING (token)
#         WHERE {token_condition} AND {pos_condition}
#         GROUP BY token, pos;
#     """
#     execute_query_with_retry(query)


# def add_remaining_tokens(dataset_id, token_table, tfidf_table, temp_table):
#     """
#     Ensure all tokens are added to temp_table with a default 'included' status.
#     """
#     query = f"""
#         INSERT INTO {temp_table}
#         SELECT 
#             '{dataset_id}' AS dataset_id,
#             token,
#             pos,
#             SUM(count) AS count_words,
#             COUNT(DISTINCT doc_id) AS count_docs,
#             MIN(tfidf_min) AS tfidf_min,
#             MAX(tfidf_max) AS tfidf_max,
#             'included' AS status
#         FROM {token_table}
#         LEFT JOIN {tfidf_table} USING (token)
#         WHERE token NOT IN (SELECT DISTINCT token FROM {temp_table})
#         GROUP BY token, pos;
#     """
#     execute_query_with_retry(query)


# def apply_rules_to_tokens_parallel(dataset_id, token_table, tfidf_table, temp_table, rules, thread_count):
#     """
#     Apply rules to tokens in parallel and ensure all tokens are included in the temp table.
#     """
#     # Parallel rule application
#     with ThreadPoolExecutor(max_workers=thread_count) as executor:
#         futures = [
#             executor.submit(apply_rule, rule, dataset_id, token_table, tfidf_table, temp_table)
#             for rule in rules
#         ]
#         for future in futures:
#             future.result()  # Ensure all threads complete

#     # Add remaining tokens with default 'included' status
#     print("Adding remaining tokens...")
#     add_remaining_tokens(dataset_id, token_table, tfidf_table, temp_table)
