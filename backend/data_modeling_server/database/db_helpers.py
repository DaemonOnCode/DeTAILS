import random
import sqlite3
import time
from typing import List, Dict, Any
from constants import DATABASE_PATH



def tuned_connection(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # 1. Use WAL for concurrency, but keep WAL file in check
    c.execute("PRAGMA journal_mode = WAL;")
    c.execute("PRAGMA wal_autocheckpoint = 500;")     # ~2 MB autotrigger

    # 2. Speed vs. durability
    c.execute("PRAGMA synchronous = NORMAL;")

    # 3. Temp tables in RAM—but only moderately sized
    c.execute("PRAGMA temp_store = MEMORY;")

    # 4. Page cache: tune to your available RAM (e.g. 20 MB here)
    c.execute("PRAGMA cache_size = -20000;")          # 20 000 × 1 024 bytes

    # (Optional) map some of the DB file into memory if OS and SQLite support it:
    # c.execute("PRAGMA mmap_size = 268435456;")      # e.g. 256 MB

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