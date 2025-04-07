import random
import sqlite3
import time
from typing import List, Dict, Any
from constants import DATABASE_PATH
from database import PostsRepository, CommentsRepository

def execute_query(query: str, params: tuple = (), keys = False) -> List[tuple]:
    with sqlite3.connect(DATABASE_PATH) as conn:
        if keys:
            conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        if keys:
            return [dict(row) for row in cursor.fetchall()]
        return cursor.fetchall()
    

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


def get_post_and_comments_from_id(post_id: str, dataset_id: str) -> Dict[str, Any]:
    posts_repo = PostsRepository()
    comments_repo = CommentsRepository()

    post = posts_repo.find_one({"id": post_id, "dataset_id": dataset_id}, columns=["id", "title", "selftext"], map_to_model=False)

    comments = comments_repo.find({"post_id": post_id, "dataset_id": dataset_id}, columns=["id", "body", "parent_id", "author"], map_to_model=False)

    comment_map = {comment["id"]: comment for comment in comments}

    for comment in comments:
        if comment["parent_id"] and comment["parent_id"] in comment_map:
            parent = comment_map[comment["parent_id"]]
            parent.setdefault("comments", []).append(comment)

    top_level_comments = [comment for comment in comments if comment["parent_id"] == post_id]
    
    # print(post, comments)
    return {**post, "comments": top_level_comments}