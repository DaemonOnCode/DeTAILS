from functools import wraps
from sqlite3 import Error as SQLiteError
from errors.database_errors import QueryExecutionError

def handle_db_errors(func):
    """
    Decorator to handle database-related errors and raise specific or generic exceptions.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except SQLiteError as e:
            # Wrap SQLite errors in a generic QueryExecutionError
            raise QueryExecutionError(f"Database query failed in {func.__name__}. Error: {e}")
        except Exception as e:
            # Catch any other unforeseen errors and wrap them in QueryExecutionError
            raise QueryExecutionError(f"An unexpected error occurred in {func.__name__}. Error: {e}")
    return wrapper
