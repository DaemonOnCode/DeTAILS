import sqlite3
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from constants import DATABASE_PATH
from routes.collection_routes import run_query_with_columns
import spacy

nlp = spacy.load("en_core_web_sm")

router = APIRouter()

@router.on_event("startup")
def initialize_database():
    """Ensure the database and table exist."""
    execute_query("""
        CREATE TABLE IF NOT EXISTS rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id INTEGER NOT NULL,
            step INTEGER NOT NULL,
            fields TEXT NOT NULL,
            words TEXT NOT NULL,
            pos TEXT,
            action TEXT NOT NULL
        );
    """)

# Define Rule model
class Rule(BaseModel):
    id: Optional[int] = None
    datasetId: str
    step: int
    fields: str
    words: str
    pos: Optional[str] = None
    action: str


def execute_query(query: str, params: tuple = ()) -> List[tuple]:
    """Execute a SQL query and return the results."""
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.fetchall()


def create_backup_tables(dataset_id: str):
    """
    Create backup tables for posts and comments for the given dataset.
    """
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()

        # Create backup for posts
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS posts_backup_{dataset_id} AS
            SELECT * FROM posts WHERE dataset_id = ?
        """, (dataset_id,))

        # Create backup for comments
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS comments_backup_{dataset_id} AS
            SELECT * FROM comments WHERE dataset_id = ?
        """, (dataset_id,))

        conn.commit()


def apply_rules_to_backup(dataset_id: str, rules: List[Dict[str, Any]]):
    """
    Apply rules to the backup tables.
    """
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Fetch posts and comments from backups
        posts = cursor.execute(f"""
            SELECT id, title, selftext FROM posts_backup_{dataset_id}
        """).fetchall()
        comments = cursor.execute(f"""
            SELECT id, body FROM comments_backup_{dataset_id}
        """).fetchall()

        # Apply rules to posts
        for post in posts:
            updated_title = apply_rules_to_text(rules, post["title"], "title")
            updated_selftext = apply_rules_to_text(rules, post["selftext"], "selftext")
            cursor.execute(f"""
                UPDATE posts_backup_{dataset_id}
                SET title = ?, selftext = ?
                WHERE id = ?
            """, (updated_title, updated_selftext, post["id"]))

        # Apply rules to comments
        for comment in comments:
            updated_body = apply_rules_to_text(rules, comment["body"], "body")
            cursor.execute(f"""
                UPDATE comments_backup_{dataset_id}
                SET body = ?
                WHERE id = ?
            """, (updated_body, comment["id"]))

        conn.commit()


def apply_rules_to_text(rules: List[Dict[str, Any]], text: str, field: str) -> str:
    """
    Apply rules to a given text field.
    - Tokenize the text with spaCy.
    - Apply rules based on matching conditions.
    """
    doc = nlp(text or "")
    tokens = []
    for token in doc:
        token_data = {
            "text": token.text,
            "pos": token.pos_,
            "lemma": token.lemma_,
            "is_stop": token.is_stop,
        }
        tokens.append(token_data)

    # Apply rules
    for rule in rules:
        if rule["fields"] != "<ANY>" and rule["fields"] != field:
            continue  # Skip if rule is not for this field
        for token in tokens:
            if rule["words"] == "<ANY>" or rule["words"] == token["text"]:
                if rule["pos"] is None or rule["pos"] == token["pos"]:
                    token["action"] = rule["action"]

    # Reconstruct text after applying rules
    return " ".join([t["text"] for t in tokens if t.get("action") != "Remove"])


@router.post("/apply-rules-to-dataset")
async def apply_rules_to_dataset(dataset_id: str):
    """
    Apply rules to posts and comments of a dataset.
    - Create backup tables for the dataset.
    - Fetch rules and apply them to the backups.
    """
    try:
        # Create backup tables
        create_backup_tables(dataset_id)

        # Fetch rules for the dataset
        rules = run_query_with_columns("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))

        # Apply rules to backup data
        apply_rules_to_backup(dataset_id, rules)

        return {"message": "Rules applied successfully to the dataset backups"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing dataset: {str(e)}")


@router.get("/processed-posts/{dataset_id}")
def get_processed_posts(dataset_id: str):
    """
    Retrieve processed posts from the backup table.
    """
    try:
        processed_posts = run_query_with_columns(f"""
            SELECT * FROM posts_backup_{dataset_id}
        """)
        return {"posts": processed_posts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching processed posts: {str(e)}")


@router.get("/processed-comments/{dataset_id}")
def get_processed_comments(dataset_id: str):
    """
    Retrieve processed comments from the backup table.
    """
    try:
        processed_comments = run_query_with_columns(f"""
            SELECT * FROM comments_backup_{dataset_id}
        """)
        return {"comments": processed_comments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching processed comments: {str(e)}")


@router.get("/datasets/{dataset_id}/rules", response_model=List[Rule])
def get_rules(dataset_id: str):
    """Fetch all rules for a dataset."""
    rows = execute_query("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))
    return [Rule(id=row[0], datasetId=row[1], step=row[2], fields=row[3], words=row[4], pos=row[5], action=row[6]) for row in rows]


















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

# def create_backup_tables(dataset_id: str):
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


# def apply_rules_to_backup(dataset_id: str, rules: List[Dict[str, Any]]):
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
# def get_rules(dataset_id: str):
#     """Fetch all rules for a dataset."""
#     rows = execute_query("SELECT * FROM rules WHERE dataset_id = ?", (dataset_id,))
#     return [Rule(id=row[0], dataset_id=row[1], step=row[2], fields=row[3], words=row[4], pos=row[5], action=row[6]) for row in rows]


# @router.post("/datasets/{dataset_id}/rules")
# def add_or_update_rules(dataset_id: str, rules: List[Rule]):
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
# def delete_all_rules(dataset_id: str):
#     """Delete all rules for a dataset."""
#     execute_query("DELETE FROM rules WHERE dataset_id = ?", (dataset_id,))
#     return {"success": True, "message": "All rules deleted"}


# @router.delete("/datasets/{dataset_id}/rules/{rule_id}")
# def delete_rule(dataset_id: str, rule_id: int):
#     """Delete a specific rule by ID."""
#     rows = execute_query("DELETE FROM rules WHERE dataset_id = ? AND id = ?", (dataset_id, rule_id))
#     if rows:
#         return {"success": True, "message": "Rule deleted"}
#     raise HTTPException(status_code=404, detail="Rule not found")

# @router.post("/apply-rules-to-dataset")
# async def apply_rules_to_dataset(dataset_id: str):
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
# def get_processed_posts(dataset_id: str):
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
# def get_processed_comments(dataset_id: str):
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
# def apply_rules(dataset_id: str, text: str):
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
# #     return token_filtering_service.list_datasets()


# # @router.get("/datasets/{dataset_id}/rules")
# # def get_rules(dataset_id: str):
# #     try:
# #         return token_filtering_service.get_filter_rules(dataset_id)
# #     except ValueError as e:
# #         raise HTTPException(status_code=404, detail=str(e))


# # @router.post("/datasets/{dataset_id}/rules")
# # def apply_rules(dataset_id: str, rules: List[Rule]):
# #     try:
# #         return token_filtering_service.apply_filter_rules(dataset_id, [rule.dict() for rule in rules])
# #     except ValueError as e:
# #         raise HTTPException(status_code=404, detail=str(e))


# # @router.post("/rules/save")
# # def save_rules(data: dict):
# #     return token_filtering_service.save_filter_rules(data)


# # @router.post("/rules/load")
# # def load_rules(data: dict):
# #     return token_filtering_service.load_filter_rules(data)
