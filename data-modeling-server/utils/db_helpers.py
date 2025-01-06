import random
import sqlite3
import time
from typing import List, Dict, Any
from constants import DATABASE_PATH


class DatabaseHelper:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def run(self, query: str, params: List[Any] = []):
        """
        Execute a query with optional parameters.
        """
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()

    def fetch_one(self, query: str, params: List[Any] = []):
        """
        Fetch a single record from the database.
        """
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchone()

    def fetch_all(self, query: str, params: List[Any] = []):
        """
        Fetch all records matching the query.
        """
        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchall()

    def create_tables(self):
        """
        Create the posts and comments tables if they do not exist.
        """
        self.run(
            """
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                over_18 INTEGER,
                subreddit TEXT,
                score INTEGER,
                thumbnail TEXT,
                permalink TEXT,
                is_self INTEGER,
                domain TEXT,
                created_utc INTEGER,
                url TEXT,
                num_comments INTEGER,
                title TEXT,
                selftext TEXT,
                author TEXT,
                hide_score INTEGER,
                subreddit_id TEXT
            )
            """
        )

        self.run(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                body TEXT,
                author TEXT,
                created_utc INTEGER,
                post_id TEXT,
                parent_id TEXT,
                controversiality INTEGER,
                score_hidden INTEGER,
                score INTEGER,
                subreddit_id TEXT,
                retrieved_on INTEGER,
                gilded INTEGER,
                FOREIGN KEY(post_id) REFERENCES posts(id)
            )
            """
        )

    def batch_insert(self, table_name: str, data: List[Dict[str, Any]], columns: List[str]):
        """
        Insert data into a table in batches.
        """
        if not data:
            return

        placeholders = ", ".join(["?" for _ in columns])
        query = f"INSERT OR REPLACE INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"

        with self._connect() as conn:
            cursor = conn.cursor()
            cursor.executemany(
                query, [tuple(item[column] for column in columns) for item in data]
            )
            conn.commit()

    def get_post_with_comments(self, post_id: str):
        """
        Get a post and its associated comments recursively.
        """
        post_query = "SELECT * FROM posts WHERE id = ?"
        comments_query = "SELECT * FROM comments WHERE post_id = ?"

        with self._connect() as conn:
            cursor = conn.cursor()
            post = cursor.execute(post_query, (post_id,)).fetchone()

            if not post:
                raise ValueError(f"Post with ID {post_id} not found")

            comments = cursor.execute(comments_query, (post_id,)).fetchall()

            # Build a recursive tree structure for comments
            comment_map = {comment["id"]: comment for comment in comments}
            for comment in comments:
                if comment["parent_id"] and comment["parent_id"] in comment_map:
                    parent = comment_map[comment["parent_id"]]
                    parent.setdefault("replies", []).append(comment)

            top_level_comments = [
                comment for comment in comments if not comment["parent_id"]
            ]

        return {"post": post, "comments": top_level_comments}


def batch_insert_posts(posts, tokenized = False):
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        if tokenized:
            cursor.executemany("""
                INSERT OR REPLACE INTO tokenized_posts (
                    post_id, title, selftext
                ) VALUES (?, ?, ?)
            """, posts)
        else:
            cursor.executemany("""
                INSERT OR REPLACE INTO posts (
                    id, over_18, subreddit, score, thumbnail, permalink, is_self,
                    domain, created_utc, url, num_comments, title, selftext,
                    author, hide_score, subreddit_id, dataset_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, posts)
        conn.commit()

# Helper to insert comments into the database
def batch_insert_comments(comments, tokenized = False):
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        if tokenized:
            cursor.executemany("""
                INSERT OR REPLACE INTO tokenized_comments (
                    comment_id, body
                ) VALUES (?, ?)
            """, comments)
        else:
            cursor.executemany("""
                INSERT OR REPLACE INTO comments (
                    id, body, author, created_utc, post_id, parent_id,
                    controversiality, score_hidden, score, subreddit_id,
                    retrieved_on, gilded, dataset_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, comments)
        conn.commit()



def get_post_with_comments(dataset_id, post_id):
    with sqlite3.connect(DATABASE_PATH) as conn:
        print("connected")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        post = cursor.execute("SELECT id, title, selftext FROM posts WHERE id = ? AND dataset_id = ?", (post_id, dataset_id)).fetchone()

        post = dict(post) if post else {}
        print(post, "post check")
        if not post:
            raise ValueError(f"Post with ID {post_id} not found")

        comments = cursor.execute("SELECT id, body, parent_id FROM comments WHERE post_id = ?", (post_id,)).fetchall()

        comments = [dict(comment) for comment in comments]

        print(comments, "comments check")
        # Build a recursive tree structure for comments
        comment_map = {comment["id"]: comment for comment in comments}
        for comment in comments:
            if comment["parent_id"] and comment["parent_id"] in comment_map:
                parent = comment_map[comment["parent_id"]]
                parent.setdefault("comments", []).append(comment)

        top_level_comments = [comment for comment in comments if comment["parent_id"] == post_id]
    print(post, "post check")
    return {} if not post else {**post, "comments": top_level_comments}


def execute_query(query: str, params: tuple = (), keys = False) -> List[tuple]:
    """Utility function to execute SQL queries."""
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