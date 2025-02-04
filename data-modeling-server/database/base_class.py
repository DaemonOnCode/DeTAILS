import sqlite3
from typing import Type, TypeVar, List, Optional, Dict, Any, Generic, get_type_hints
from sqlite3 import Cursor, Row
from dataclasses import fields, asdict

from constants import DATABASE_PATH
from database.initialize import SQLITE_TYPE_MAPPING
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
    def create_table(self) -> None:
        """
        Creates a table dynamically based on the dataclass model fields.

        The model's field names and types are mapped to SQLite types automatically.
        """
        if not self.model:
            raise ValueError("Model must be defined to create a table dynamically.")

        # Extract field names and types
        columns = []
        primary_keys = []
        for field in fields(self.model):
            field_name = field.name
            field_type = get_type_hints(self.model).get(field_name, str)  # Default to TEXT
            sql_type = SQLITE_TYPE_MAPPING.get(field_type, "TEXT")  # Map Python types to SQLite types

            # Check if the field has a primary key annotation
            if field.metadata.get("primary_key", False):
                primary_keys.append(field_name)

            columns.append(f"{field_name} {sql_type}")

        # Add primary key constraints if applicable
        if primary_keys:
            columns.append(f"PRIMARY KEY ({', '.join(primary_keys)})")

        # Create SQL query
        column_definitions = ", ".join(columns)
        create_query = f"CREATE TABLE IF NOT EXISTS {self.table_name} ({column_definitions});"

        # Execute the query
        self.execute_query(create_query)

    @handle_db_errors
    def execute_query(self, query: str, params: tuple = (), result = False)->(Cursor | None):
        """
        Executes a SQL query with the given parameters.
        """
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            query_result = cursor.execute(query, params)
            conn.commit()
            if result:
                return query_result

    @handle_db_errors
    def fetch_all(self, query: str, params: tuple = (), map_to_model = True) -> List[T] | List[Dict[str, Any]]:
        """
        Fetches all rows for a given query and maps them to the dataclass model.
        """
        with sqlite3.connect(DATABASE_PATH) as conn:
            conn.row_factory = Row
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
        if map_to_model:
            return [self._map_to_model(row) for row in rows]
        return [dict(row) for row in rows]

    @handle_db_errors
    def fetch_one(self, query: str, params: tuple = (), map_to_model = True) -> Optional[T] | Optional[Dict[str, Any]]:
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
        if not map_to_model:
            return dict(row)
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
            return self.execute_query(query, params, result=True)
        except sqlite3.Error as e:
            raise InsertError(f"Failed to insert data into table {self.table_name}. Error: {e}")

    @handle_db_errors
    def insert_batch(self, data_list: List[T]) -> None:
        """
        Inserts multiple rows into the table efficiently using executemany.

        :param data_list: List of dataclass instances to insert.
        """
        if not data_list:
            return

        try:
            data_dicts = [asdict(data) for data in data_list]
            query, params_list = self.query_builder_instance.insert_batch(data_dicts)

            with sqlite3.connect(DATABASE_PATH) as conn:
                cursor = conn.cursor()
                cursor.executemany(query, params_list)
                conn.commit()
        except sqlite3.Error as e:
            raise InsertError(f"Failed to insert batch data into table {self.table_name}. Error: {e}")

    @handle_db_errors
    def update(self, filters: Dict[str, Any], updates: Dict[str,Any]) -> None:
        """
        Updates rows in the table based on filters using the QueryBuilder.

        :param filters: Dictionary of filter conditions (keys are column names as strings).
        :param updates: An instance of the dataclass with updated values.
        """
        try:
            # update_dict = asdict(updates)
            query, params = self.query_builder_instance.update(filters, updates)
            return self.execute_query(query, params, result=True)
        except sqlite3.Error as e:
            raise UpdateError(f"Failed to update records in table {self.table_name}. Error: {e}")

    @handle_db_errors
    def bulk_update(self, updates_list: List[Dict[str, Any]], filters_list: List[Dict[str, Any]]) -> None:
        """
        Updates multiple rows efficiently using batch updates.

        :param updates_list: List of update dictionaries.
        :param filters_list: List of filter conditions corresponding to each update.
        """
        if not updates_list or not filters_list:
            return

        try:
            query_params_list = [
                self.query_builder_instance.update(filters, updates)
                for filters, updates in zip(filters_list, updates_list)
            ]

            with sqlite3.connect(DATABASE_PATH) as conn:
                cursor = conn.cursor()
                cursor.executemany(query_params_list[0][0], [qp[1] for qp in query_params_list])
                conn.commit()
        except sqlite3.Error as e:
            raise UpdateError(f"Failed to perform batch update in table {self.table_name}. Error: {e}")

    @handle_db_errors
    def delete(self, filters: Dict[str, Any]):
        """
        Deletes rows from the table based on filters using the QueryBuilder.

        :param filters: Dictionary of filter conditions (keys are column names as strings).
        """
        try:
            query, params = self.query_builder_instance.delete(filters)
            return self.execute_query(query, params, result=True)
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
    
    @handle_db_errors
    def find_one(self, filters: Optional[Dict[str, Any]] = None, columns: Optional[List[str]] = None) -> T | None:
        """
        Finds rows in the table based on filters and selects specific columns using the QueryBuilder.

        :param filters: Dictionary of filter conditions (keys are column names as strings).
        :param columns: List of column names to select (optional). If not provided, selects all columns.
        :return: List of dataclass instances.
        """
        if columns:
            self.query_builder_instance.select(columns)
        query, params = self.query_builder_instance.find(filters)
        return self.fetch_one(query, params)

    @handle_db_errors
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Counts the number of rows that match the given filters.

        :param filters: Dictionary of filter conditions (keys are column names as strings).
        :return: Number of matching rows.
        """
        query, params = self.query_builder_instance.count(filters)
        with sqlite3.connect(DATABASE_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchone()[0]
        
    @handle_db_errors
    def execute_raw_query(self, query: str, params: tuple = (), keys = False) -> Any:
        """
        Executes a raw SQL query with parameters.

        :param query: The SQL query string.
        :param params: Parameters for the query.
        """
        with sqlite3.connect(DATABASE_PATH) as conn:
            if keys:
                conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            result = cursor.execute(query, params)
            conn.commit()
            if keys:
                return [dict(row) for row in result]
            return result
        
    @handle_db_errors
    def backup_table(self, filters: Optional[Dict[str, Any]] = None) -> None:
        """
        Creates a backup table by copying rows from the original table based on user-specified filters.

        - If `filters` are provided, only matching rows are backed up.
        - If no filters are provided, the entire table is backed up.

        :param filters: (Optional) A dictionary where keys are column names and values are filter values.
                        Example: {"dataset_id": "123", "user_id": "456"}
        """
        # Generate a normalized backup table name based on filters
        if filters:
            normalized_filters = "_".join(f"{key}_{str(value).replace('-', '_')}" for key, value in filters.items())
            backup_table_name = f"{self.table_name}_backup_{normalized_filters}"
            
            # Generate WHERE conditions dynamically
            conditions = " AND ".join(f"{key} = ?" for key in filters.keys())
            where_clause = f"WHERE {conditions}"
            values = tuple(filters.values())
        else:
            backup_table_name = f"{self.table_name}_backup_full"
            where_clause = ""
            values = ()

        # SQL query to create the backup table dynamically
        backup_query = f"""
            CREATE TABLE IF NOT EXISTS {backup_table_name} AS
            SELECT * FROM {self.table_name} {where_clause}
        """

        return self.execute_query(backup_query, values, result=True)


    @handle_db_errors
    def drop_table(self) -> None:
        """
        Drops only the table managed by this repository.
        
        Prevents deletion of any other tables.
        """
        drop_query = f"DROP TABLE IF EXISTS {self.table_name}"

        return self.execute_query(drop_query, result=True)

    def _map_to_model(self, row: Row) -> T:
        """
        Maps a database row to a dataclass instance.

        :param row: A database row as a dictionary.
        :return: An instance of the dataclass model.
        """
        row_dict = {key: row[key] for key in row.keys() if key in self.query_builder_instance.model_fields}
        return self.model(**row_dict)
