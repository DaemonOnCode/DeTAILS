import random
import sqlite3
import time
from typing import List, Dict, Any
from constants import DATABASE_PATH



def tuned_connection(db_path: str = DATABASE_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("PRAGMA journal_mode = WAL;")
    c.execute("PRAGMA wal_autocheckpoint = 500;") 

    c.execute("PRAGMA synchronous = NORMAL;")

    c.execute("PRAGMA temp_store = MEMORY;")
    c.execute("PRAGMA cache_size = -20000;")          # 20000 × 1024 bytes

    return conn



def execute_query(query: str, params: tuple = (), keys = False) -> List[tuple]:
    with tuned_connection(DATABASE_PATH) as conn:
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
            with tuned_connection(DATABASE_PATH) as conn:
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