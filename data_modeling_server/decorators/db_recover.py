import functools
import sqlite3
import subprocess
import os
import shutil
from constants import DATABASE_PATH  

def auto_recover(func):
    """
    Standalone decorator that attempts auto-recovery of a corrupt SQLite database.
    If the decorated function raises a sqlite3.DatabaseError whose message contains
    "malformed" or "corrupt", the decorator runs the .recover command via the sqlite3 CLI
    to recover the database. After recovery, it retries the decorated function.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except sqlite3.DatabaseError as e:
            msg = str(e).lower()
            if "malformed" in msg or "corrupt" in msg:
                print("Database corruption detected. Attempting auto recovery...")
                corrupt_db = DATABASE_PATH
                base, ext = os.path.splitext(corrupt_db)
                recovered_db = f"{base}_recovered{ext}"
                sqlite3_cli = "sqlite3"
                cmd = f'{sqlite3_cli} "{corrupt_db}" ".recover" | {sqlite3_cli} "{recovered_db}"'
                print(f"Running recovery command: {cmd}")
                subprocess.check_call(cmd, shell=True)
                if os.path.exists(corrupt_db):
                    os.remove(corrupt_db)
                shutil.move(recovered_db, corrupt_db)
                print("Database auto recovery performed. Retrying operation...")
                return func(*args, **kwargs)
            else:
                raise
    return wrapper
