class DatabaseError(Exception):
    """Base class for all database errors."""
    pass


class QueryExecutionError(DatabaseError):
    """Raised when a query fails to execute."""
    pass


class RecordNotFoundError(DatabaseError):
    """Raised when a specific record is not found."""
    pass


class InsertError(DatabaseError):
    """Raised when an insert operation fails."""
    pass


class UpdateError(DatabaseError):
    """Raised when an update operation fails."""
    pass


class DeleteError(DatabaseError):
    """Raised when a delete operation fails."""
    pass
