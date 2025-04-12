from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import re
import sqlite3
from typing import Any, Dict, List
from uuid import uuid4

from attr import asdict
import spacy
from constants import DATABASE_PATH
from database import RulesRepository, PostsRepository, CommentsRepository, TokensRepository, TokenizedPostsRepository, TokenizedCommentsRepository, TfidfRepository
from database.db_helpers import execute_query_with_retry
from database.temp_token_stats_table import TempTokenStatsRepository
from models import Rule, Tfidf, Token


rules_repo = RulesRepository()
post_repo = PostsRepository()
comment_repo = CommentsRepository()


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
    post_repo.backup_table({"dataset_id": dataset_id})
    return {"message": "Post table backed up successfully"}

def backup_comment_table(dataset_id: str):
    """Backup the comment table for a dataset."""
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
    
def sanitize_data(dataset_id: str) -> str:
    return dataset_id.replace("-", "_")

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
    """Creates backup tables for posts and comments of a dataset."""
    backup_post_table(dataset_id)
    backup_comment_table(dataset_id)
    

class TokenProcessingService:
    def __init__(self, dataset_id: str):
        self.dataset_id = dataset_id
        self.sanitized_id = sanitize_data(dataset_id)
        self.tokens_table = f"tokens_{self.sanitized_id}"
        self.posts_backup_table = f"posts_backup_{self.sanitized_id}"
        self.comments_backup_table = f"comments_backup_{self.sanitized_id}"
        self.tfidf_table = f"tfidf_{self.sanitized_id}"
        self.tokens_repo = TokensRepository(dataset_id)
        self.tfidf_repo = TfidfRepository(dataset_id)

    def create_token_table(self) -> None:
        self.tokens_repo.create_table()

    def populate_token_table_parallel(self, batch_size: int) -> None:
        query = f"""
            SELECT id, title || ' ' || selftext AS content
            FROM {self.posts_backup_table}
            UNION ALL
            SELECT id, body AS content
            FROM {self.comments_backup_table};
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
                    future = executor.submit(self.process_documents, rows, nlp)
                    tokens = future.result()
                    self.tokens_repo.insert_batch([
                        Token(doc_id=token["doc_id"], token=token["token"], pos=token["pos"], count=token["count"])
                        for token in tokens
                    ])
            conn.commit()

    def process_documents(self, rows, nlp) -> List[Dict[str, Any]]:
        tokens = []
        for doc_id, raw_text in rows:
            if not raw_text.strip():
                continue
            doc = nlp(re.sub(r'\s+', ' ', raw_text.strip()))
            token_counts = defaultdict(int)
            for token in self.filter_tokens(doc):
                key = (token["text"], token["pos"])
                token_counts[key] += 1
            for (text, pos), count in token_counts.items():
                tokens.append({"doc_id": doc_id, "token": text, "pos": pos, "count": count})
        return tokens

    @staticmethod
    def filter_tokens(doc) -> List[Dict[str, Any]]:
        return [{"text": token.text, "pos": token.pos_} for token in doc]

    def compute_global_tfidf(self) -> str:
        doc_frequency_table = f"doc_frequency_{self.sanitized_id}"
        tfidf_per_doc_table = f"tfidf_per_doc_{self.sanitized_id}"
        self.tfidf_repo.create_table()
        execute_query_with_retry(f"""
            CREATE TABLE IF NOT EXISTS {doc_frequency_table} AS
            SELECT token, COUNT(DISTINCT doc_id) AS doc_frequency
            FROM {self.tokens_repo.table_name}
            GROUP BY token;
        """)
        total_docs_query = f"SELECT COUNT(DISTINCT doc_id) FROM {self.tokens_repo.table_name};"
        total_docs = execute_query_with_retry(total_docs_query)[0][0]
        # total_docs = self.tokens_repo.count("doc_id")
        execute_query_with_retry(f"""
            CREATE TABLE IF NOT EXISTS {tfidf_per_doc_table} AS
            SELECT 
                t.token,
                t.doc_id,
                SUM(t.count) AS term_frequency,
                SUM(t.count) * LOG(1 + {total_docs} / (1 + df.doc_frequency)) AS doc_tfidf
            FROM {self.tokens_repo.table_name} t
            JOIN {doc_frequency_table} df ON t.token = df.token
            GROUP BY t.token, t.doc_id;
        """)
        execute_query_with_retry(f"""
            INSERT OR REPLACE INTO {self.tfidf_repo.table_name}
            SELECT 
                token,
                MIN(doc_tfidf) AS tfidf_min,
                MAX(doc_tfidf) AS tfidf_max
            FROM {tfidf_per_doc_table}
            GROUP BY token;
        """)
        execute_query_with_retry(f"DROP TABLE IF EXISTS {doc_frequency_table};")
        execute_query_with_retry(f"DROP TABLE IF EXISTS {tfidf_per_doc_table};")
        return self.tfidf_repo.table_name
    
    def drop_temp_tables(self) -> None:
        self.tokens_repo.drop_table()
        self.tfidf_repo.drop_table()

class RuleApplicationService:
    def __init__(self, dataset_id: str):
        self.dataset_id = dataset_id
        self.sanitized_id = sanitize_data(dataset_id)
        self.temp_table = f"temp_token_stats_{self.sanitized_id}"
        self.temp_repo = TempTokenStatsRepository(dataset_id)

    def create_temp_table(self) -> None:
        self.temp_repo.create_table()

    def apply_rule(self, rule: Dict[str, Any], token_table: str, tfidf_table: str) -> None:
        token_condition = f"token = '{rule['words']}'" if rule["words"] != "<ANY>" else "1=1"
        pos_condition = f"pos = '{rule['pos']}'" if rule["pos"] else "1=1"
        status = 'removed' if rule["action"] == "Remove" else 'included'
        query = f"""
            INSERT INTO {self.temp_table}
            SELECT 
                '{self.dataset_id}' AS dataset_id,
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

    def add_remaining_tokens(self, token_table: str, tfidf_table: str) -> None:
        query = f"""
            INSERT INTO {self.temp_table}
            SELECT 
                '{self.dataset_id}' AS dataset_id,
                token,
                pos,
                SUM(count) AS count_words,
                COUNT(DISTINCT doc_id) AS count_docs,
                MIN(tfidf_min) AS tfidf_min,
                MAX(tfidf_max) AS tfidf_max,
                'included' AS status
            FROM {token_table}
            LEFT JOIN {tfidf_table} USING (token)
            WHERE token NOT IN (SELECT DISTINCT token FROM {self.temp_table})
            GROUP BY token, pos;
        """
        execute_query_with_retry(query)

    def apply_rules_parallel(self, token_table: str, tfidf_table: str,
                             rules: List[Dict[str, Any]], thread_count: int) -> None:
        with ThreadPoolExecutor(max_workers=thread_count) as executor:
            futures = [
                executor.submit(self.apply_rule, rule, token_table, tfidf_table)
                for rule in rules
            ]
            for future in futures:
                future.result()
        self.add_remaining_tokens(token_table, tfidf_table)

