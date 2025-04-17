class DatabaseError(Exception):
    pass


class QueryExecutionError(DatabaseError):
    pass


class RecordNotFoundError(DatabaseError):
    pass


class InsertError(DatabaseError):
    pass


class UpdateError(DatabaseError):
    pass


class DeleteError(DatabaseError):
    pass
