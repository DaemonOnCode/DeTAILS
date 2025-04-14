from functools import wraps
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
from decorators import handle_db_errors, auto_recover

T = TypeVar("T") 

class EnsureSchemaSynced:
    def __init__(self, method):
        """Initialize the decorator with the method to be decorated."""
        self.method = method

    def __get__(self, instance, owner):
        """
        Bind the method to the instance when accessed.
        
        Args:
            instance: The instance of the class (self).
            owner: The class owning the method.
        
        Returns:
            A wrapper function bound to the instance.
        """
        @wraps(self.method)
        def wrapper(*args, **kwargs):
            if instance is not None:
                # Access the instance (self) and call a method on it
                instance.sync_table_schema()
            # Call the original method with the instance and arguments
            return self.method(instance, *args, **kwargs)
        return wrapper

class BaseRepository(Generic[T]):
    def __init__(self, table_name: str, model: Type[T], database_path: str = DATABASE_PATH):
        self.table_name = table_name
        self.model = model
        self.query_builder_instance = QueryBuilder(table_name, model)
        self.database_path = database_path
        self.sync_table_schema()

    def query_builder(self) -> QueryBuilder[T]:
        return self.query_builder_instance
    
    def set_database_path(self, database_path: str) -> None:
        self.database_path = database_path

    def get_table_schema(self) -> Dict[str, str]:
        """Retrieve the current schema of the table as a name:type dictionary."""
        try:
            with sqlite3.connect(self.database_path) as conn:
                cursor = conn.cursor()
                cursor.execute(f"PRAGMA table_info({self.table_name})")
                return {col[1]: col[2] for col in cursor.fetchall()}
        except sqlite3.Error:
            return {}

    def get_model_fields(self) -> Dict[str, type]:
        """Extract field names and types from the model."""
        return {field.name: field.type for field in fields(self.model)}

    def sync_table_schema(self) -> None:
        """Sync the table schema with the model fields."""
        # Check if table exists; create it if not
        with sqlite3.connect(self.database_path) as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{self.table_name}'")
            if not cursor.fetchone():
                # Create table based on model fields
                model_fields = self.get_model_fields()
                columns = ", ".join(f"{name} {SQLITE_TYPE_MAPPING.get(type_, 'TEXT')}"
                                  for name, type_ in model_fields.items())
                query = f"CREATE TABLE {self.table_name} ({columns})"
                cursor.execute(query)
                conn.commit()
                return

        # If table exists, sync by adding missing columns
        table_schema = self.get_table_schema()
        model_fields = self.get_model_fields()
        missing_columns = set(model_fields.keys()) - set(table_schema.keys())

        if missing_columns:
            with sqlite3.connect(self.database_path) as conn:
                cursor = conn.cursor()
                for col in missing_columns:
                    col_type = SQLITE_TYPE_MAPPING.get(model_fields[col], "TEXT")
                    query = f"ALTER TABLE {self.table_name} ADD COLUMN {col} {col_type}"
                    cursor.execute(query)
                conn.commit()

    def ensure_schema_synced(self, method):
        """Decorator to ensure schema is synced before every method execution."""
        def wrapper(*args, **kwargs):
            self.sync_table_schema()
            return method(self, *args, **kwargs)
        return wrapper
    
    @handle_db_errors
    @auto_recover
    def create_table(self) -> None:
        if not self.model:
            raise ValueError("Model must be defined to create a table dynamically.")

        columns = []
        primary_keys = []
        for field in fields(self.model):
            field_name = field.name
            field_type = get_type_hints(self.model).get(field_name, str) 
            sql_type = SQLITE_TYPE_MAPPING.get(field_type, "TEXT")  

            if field.metadata.get("primary_key", False):
                primary_keys.append(field_name)

            columns.append(f"{field_name} {sql_type}")

        if primary_keys:
            columns.append(f"PRIMARY KEY ({', '.join(primary_keys)})")

        column_definitions = ", ".join(columns)
        create_query = f"CREATE TABLE IF NOT EXISTS {self.table_name} ({column_definitions});"

        self.execute_query(create_query)

    @handle_db_errors
    @auto_recover
    def execute_query(self, query: str, params: tuple = (), result = False)->(Cursor | None):
        with sqlite3.connect(self.database_path) as conn:
            cursor = conn.cursor()
            query_result = cursor.execute(query, params)
            conn.commit()
            if result:
                return query_result

    @handle_db_errors   
    @auto_recover  
    def execute_many_query(self, query: str, params_list: List[tuple], result = False) -> None:
        with sqlite3.connect(self.database_path) as conn:
            cursor = conn.cursor()
            query_result = cursor.executemany(query, params_list)
            conn.commit()
            if result:
                return query_result

    @handle_db_errors
    @auto_recover
    def fetch_all(self, query: str, params: tuple = (), map_to_model = True) -> List[T] | List[Dict[str, Any]]:
        with sqlite3.connect(self.database_path) as conn:
            conn.row_factory = Row
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
        if map_to_model:
            return [self._map_to_model(row) for row in rows]
        return [dict(row) for row in rows]

    @handle_db_errors
    @auto_recover
    def fetch_one(self, query: str, params: tuple = (), map_to_model = True) -> Optional[T] | Optional[Dict[str, Any]]:
        with sqlite3.connect(self.database_path) as conn:
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
    @auto_recover
    def insert(self, data: T) -> None:
        try:
            data_dict = asdict(data)
            query, params = self.query_builder_instance.insert(data_dict)
            # print(query, params)
            return self.execute_query(query, params, result=True)
        except sqlite3.Error as e:
            raise InsertError(f"Failed to insert data into table {self.table_name}. Error: {e}")

    @handle_db_errors
    @auto_recover
    def insert_batch(self, data_list: List[T]) -> None:
        if not data_list:
            return

        try:
            data_dicts = [asdict(data) for data in data_list]
            query, params_list = self.query_builder_instance.insert_batch(data_dicts)

            self.execute_many_query(query, params_list)
        except sqlite3.Error as e:
            raise InsertError(f"Failed to insert batch data into table {self.table_name}. Error: {e}")

    @handle_db_errors
    @auto_recover
    def update(self, filters: Dict[str, Any], updates: Dict[str,Any]) -> None:
        try:
            # update_dict = asdict(updates)
            query, params = self.query_builder_instance.update(filters, updates)
            return self.execute_query(query, params, result=True)
        except sqlite3.Error as e:
            raise UpdateError(f"Failed to update records in table {self.table_name}. Error: {e}")

    @handle_db_errors
    @auto_recover
    def bulk_update(self, updates_list: List[Dict[str, Any]], filters_list: List[Dict[str, Any]]) -> None:
        if not updates_list or not filters_list:
            return

        try:
            query_params_list = [
                self.query_builder_instance.update(filters, updates)
                for filters, updates in zip(filters_list, updates_list)
            ]

            self.execute_many_query(query_params_list[0][0], [qp[1] for qp in query_params_list])
        except sqlite3.Error as e:
            raise UpdateError(f"Failed to perform batch update in table {self.table_name}. Error: {e}")

    @handle_db_errors
    @auto_recover
    def delete(self, filters: Dict[str, Any]):
        try:
            query, params = self.query_builder_instance.delete(filters)
            return self.execute_query(query, params, result=True)
        except sqlite3.Error as e:
            raise DeleteError(f"Failed to delete records from table {self.table_name}. Error: {e}")

    @handle_db_errors
    @auto_recover
    def find(
        self,
        filters: Optional[Dict[str, Any]] = None,
        columns: Optional[List[str]] = None,
        map_to_model: bool = True,
        order_by: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[T] | List[Dict[str, Any]]:
        if columns:
            self.query_builder_instance.select(*columns)
        if order_by:
            for column, direction in order_by.items():
                descending = direction.lower() == "desc"
                self.query_builder_instance.order_by(column, descending)
        if limit is not None:
            self.query_builder_instance.limit(limit)
        query, params = self.query_builder_instance.find(filters)
        # print(query, params)
        result = self.fetch_all(query, params, map_to_model=map_to_model)
        self.query_builder_instance.reset()
        return result
        
    @handle_db_errors
    @auto_recover
    def find_one(self, filters: Optional[Dict[str, Any]] = None, columns: Optional[List[str]] = None, map_to_model=True, order_by: Optional[Dict[str, Any]] = None) -> T | Dict[str, Any] | None:
        if order_by:
            self.query_builder_instance.order_by(**order_by)
        if columns:
            self.query_builder_instance.select(*columns)
        query, params = self.query_builder_instance.find(filters)
        return self.fetch_one(query, params, map_to_model=map_to_model)

    @handle_db_errors
    @auto_recover
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        query, params = self.query_builder_instance.count(filters)
        with sqlite3.connect(self.database_path) as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchone()[0]
        
    @handle_db_errors
    @auto_recover
    def execute_raw_query(self, query: str, params: tuple = (), keys = False) -> Any:
        with sqlite3.connect(self.database_path) as conn:
            if keys:
                conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            result = cursor.execute(query, params)
            conn.commit()
            if keys:
                return [dict(row) for row in result]
            return result
        
    @handle_db_errors
    @auto_recover
    def backup_table(self, filters: Optional[Dict[str, Any]] = None) -> None:
        if filters:
            normalized_filters = "_".join(f"{key}_{str(value).replace('-', '_')}" for key, value in filters.items())
            backup_table_name = f"{self.table_name}_backup_{normalized_filters}"

            conditions = " AND ".join(f"{key} = ?" for key in filters.keys())
            where_clause = f"WHERE {conditions}"
            values = tuple(filters.values())
        else:
            backup_table_name = f"{self.table_name}_backup_full"
            where_clause = ""
            values = ()

        backup_query = f"""
            CREATE TABLE IF NOT EXISTS {backup_table_name} AS
            SELECT * FROM {self.table_name} {where_clause}
        """

        return self.execute_query(backup_query, values, result=True)


    @handle_db_errors
    @auto_recover
    def drop_table(self) -> None:
        drop_query = f"DROP TABLE IF EXISTS {self.table_name}"

        return self.execute_query(drop_query, result=True)

    def _map_to_model(self, row: Row) -> T:
        row_dict = {key: row[key] for key in row.keys() if key in self.query_builder_instance.model_fields}
        return self.model(**row_dict)
