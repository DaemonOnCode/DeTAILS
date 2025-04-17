from functools import wraps
from sqlite3 import Error as SQLiteError
from errors.database_errors import QueryExecutionError

def handle_db_errors(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except SQLiteError as e:
            raise QueryExecutionError(f"Database query failed in {func.__name__}. Error: {e}")
        except Exception as e:
            raise QueryExecutionError(f"An unexpected error occurred in {func.__name__}. Error: {e}")
    return wrapper
