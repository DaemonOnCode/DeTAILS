import sqlite3
from typing import Type, TypeVar, List, Optional, Dict, Any, Generic
from sqlite3 import Row
from dataclasses import fields, asdict
from constants import DATABASE_PATH
from database.query_builder import QueryBuilder
from errors.database_errors import (
    RecordNotFoundError,
    InsertError,
    UpdateError,
    DeleteError
)
from decorators.db_error_decorator import handle_db_errors

T = TypeVar("T")  # Generic type for the dataclass model


class BaseRepository(Generic[T]):
    def __init__(self, table_name: str, model: Type[T]):
        """
        Base repository to handle generic database operations.

        :param table_name: Name of the database table.
        :param model: Dataclass model corresponding to the table.
        """
        self.table_name = table_name
        self.model = model
        self.query_builder_instance = QueryBuilder(table_name, model)

    def query_builder(self) -> QueryBuilder[T]:
        """
        Returns a type-safe QueryBuilder instance for this repository.
        """
        return self.query_builder_instance

    @handle_db_errors
    def execute_query(self, query: str, params: tuple = ()) -> None:
        """
        Executes a SQL query with the given parameters.
        """
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            conn.commit()

    @handle_db_errors
    def fetch_all(self, query: str, params: tuple = ()) -> List[T]:
        """
        Fetches all rows for a given query and maps them to the dataclass model.
        """
        with sqlite3.connect(DATABASE_PATH) as conn:
            conn.row_factory = Row
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
        return [self._map_to_model(row) for row in rows]

    @handle_db_errors
    def fetch_one(self, query: str, params: tuple = ()) -> Optional[T]:
        """
        Fetches a single row for a given query and maps it to the dataclass model.
        """
        with sqlite3.connect(DATABASE_PATH) as conn:
            conn.row_factory = Row
            cursor = conn.cursor()
            cursor.execute(query, params)
            row = cursor.fetchone()
        if not row:
            raise RecordNotFoundError(f"Record not found for query: {query} with params: {params}")
        return self._map_to_model(row)

    @handle_db_errors
    def insert(self, data: T) -> None:
        """
        Inserts a new row into the table using the QueryBuilder.

        :param data: An instance of the dataclass representing the row to insert.
        """
        try:
            data_dict = asdict(data)
            query, params = self.query_builder_instance.insert(data_dict)
            self.execute_query(query, params)
        except sqlite3.Error as e:
            raise InsertError(f"Failed to insert data into table {self.table_name}. Error: {e}")

    @handle_db_errors
    def update(self, filters: Dict[str, Any], updates: T) -> None:
        """
        Updates rows in the table based on filters using the QueryBuilder.

        :param filters: Dictionary of filter conditions (keys are column names as strings).
        :param updates: An instance of the dataclass with updated values.
        """
        try:
            update_dict = asdict(updates)
            query, params = self.query_builder_instance.update(filters, update_dict)
            self.execute_query(query, params)
        except sqlite3.Error as e:
            raise UpdateError(f"Failed to update records in table {self.table_name}. Error: {e}")

    @handle_db_errors
    def delete(self, filters: Dict[str, Any]) -> None:
        """
        Deletes rows from the table based on filters using the QueryBuilder.

        :param filters: Dictionary of filter conditions (keys are column names as strings).
        """
        try:
            query, params = self.query_builder_instance.delete(filters)
            self.execute_query(query, params)
        except sqlite3.Error as e:
            raise DeleteError(f"Failed to delete records from table {self.table_name}. Error: {e}")

    @handle_db_errors
    def find(self, filters: Optional[Dict[str, Any]] = None, columns: Optional[List[str]] = None) -> List[T]:
        """
        Finds rows in the table based on filters and selects specific columns using the QueryBuilder.

        :param filters: Dictionary of filter conditions (keys are column names as strings).
        :param columns: List of column names to select (optional). If not provided, selects all columns.
        :return: List of dataclass instances.
        """
        if columns:
            self.query_builder_instance.select(columns)
        query, params = self.query_builder_instance.find(filters)
        return self.fetch_all(query, params)



    def _map_to_model(self, row: Row) -> T:
        """
        Maps a database row to a dataclass instance.

        :param row: A database row as a dictionary.
        :return: An instance of the dataclass model.
        """
        row_dict = {key: row[key] for key in row.keys() if key in self.query_builder_instance.model_fields}
        return self.model(**row_dict)
