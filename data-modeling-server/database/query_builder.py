from typing import Optional, TypeVar, Generic, Tuple, Any, List, Dict, get_type_hints
from dataclasses import fields
from datetime import datetime

T = TypeVar("T")  # Represents the dataclass

class QueryBuilder(Generic[T]):
    def __init__(self, table_name: str, model: T):
        """
        Initialize the QueryBuilder with the table name and dataclass model.

        :param table_name: Name of the database table.
        :param model: The dataclass representing the table structure.
        """
        self.table_name = table_name
        self.model_fields = {field.name: field.type for field in fields(model)}
        self.filters: List[Tuple[str, str, Any]] = []  # Stores (column, operator, value)
        self.order_by_clause = ""
        self.limit_clause = ""
        self.group_by_clause = ""
        self.selected_columns = "*"  # Defaults to selecting all columns

    def _validate_column(self, column: str) -> None:
        """ Validates that the column exists in the dataclass. """
        if column not in self.model_fields:
            raise ValueError(f"Invalid column: {column}. Allowed columns: {list(self.model_fields.keys())}")

    def _validate_value(self, column: str, value: Any) -> None:
        """ Validates that the value matches the column type. """
        expected_type = self.model_fields[column]
        if not isinstance(value, expected_type) and value is not None:
            raise TypeError(f"Invalid type for column '{column}'. Expected {expected_type}, got {type(value)}.")

    # SELECT Operations
    def where(self, column: str, value: Any, operator: str = "=") -> "QueryBuilder[T]":
        """ Adds a WHERE condition to the query. """
        if operator not in ("=", "!=", ">", "<", ">=", "<=", "IN", "NOT IN"):
            raise ValueError(f"Invalid operator: {operator}. Allowed operators: =, !=, >, <, >=, <=, IN, NOT IN")
        if isinstance(value, list):
            self._validate_column(column)
            if not len(value):  # Avoid empty lists causing SQL errors
                return self
            for val in value:
                self._validate_value(column, val)
        else:    
            self._validate_column(column)
            self._validate_value(column, value)
        self.filters.append((column, operator, value))
        return self

    def order_by(self, column: str, descending: bool = False) -> "QueryBuilder[T]":
        """ Adds an ORDER BY clause to the query. """
        self._validate_column(column)
        direction = "DESC" if descending else "ASC"
        self.order_by_clause = f"ORDER BY {column} {direction}"
        return self

    def limit(self, count: int) -> "QueryBuilder[T]":
        """ Adds a LIMIT clause to the query. """
        self.limit_clause = f"LIMIT {count}"
        return self

    # def build(self) -> Tuple[str, Tuple[Any, ...]]:
    #     """
    #     Constructs the SQL query and parameters.

    #     :return: A tuple of (query, params).
    #     """
    #     where_clause = ""
    #     params = []

    #     if self.filters:
    #         clauses = []
    #         for column, operator, value in self.filters:
    #             clauses.append(f"{column} {operator} ?")
    #             params.append(value)
    #         where_clause = "WHERE " + " AND ".join(clauses)

    #     query = f"SELECT * FROM {self.table_name}"
    #     if where_clause:
    #         query += f" {where_clause}"
    #     if self.order_by_clause:
    #         query += f" {self.order_by_clause}"
    #     if self.limit_clause:
    #         query += f" {self.limit_clause}"

    #     return query, tuple(params)
    
    def select(self, *columns: str) -> "QueryBuilder[T]":
        """ Specifies the columns to select. """
        for column in columns:
            self._validate_column(column)
        self.selected_columns = ", ".join(columns)
        return self

    def group_by(self, column: str) -> "QueryBuilder[T]":
        """ Adds a GROUP BY clause. """
        self._validate_column(column)
        self.group_by_clause = f"GROUP BY {column}"
        return self

    def count(self, filters: Optional[Dict[str, Any]] = None) -> Tuple[str, Tuple[Any, ...]]:
        """ Generates a COUNT query with optional filters. """
        query, params = self.find(filters)
        count_query = query.replace(f"SELECT {self.selected_columns}", "SELECT COUNT(*)")
        return count_query, params
    
    def find(self, filters: Optional[Dict[str, Any]] = None) -> Tuple[str, Tuple[Any, ...]]:
        """Generates a SELECT query with optional WHERE conditions, supporting multi-value search."""
        where_clause = ""
        params = []

        filters = filters or {}

        if len(filters.keys()) or len(self.filters):
            clauses = []
            for column, value in filters.items():
                self._validate_column(column)

                if isinstance(value, list):  # Handle multi-value search
                    if not value:  # Avoid empty lists causing SQL errors
                        raise ValueError(f"Filter for '{column}' cannot be an empty list.")
                    placeholders = ", ".join(["?"] * len(value))
                    clauses.append(f"{column} IN ({placeholders})")
                    params.extend(value)
                else:
                    self._validate_value(column, value)
                    clauses.append(f"{column} = ?")
                    params.append(value)
            
            for column, operator, value in self.filters:
                if isinstance(value, list):  # Handle multi-value search
                    if not value:  # Avoid empty lists causing SQL errors
                        raise ValueError(f"Filter for '{column}' cannot be an empty list.")
                    placeholders = ", ".join(["?"] * len(value))
                    clauses.append(f"{column} {operator} ({placeholders})")
                    params.extend(value)
                else:
                    self._validate_value(column, value)
                    clauses.append(f"{column} {operator} ?")
                    params.append(value)


            where_clause = "WHERE " + " AND ".join(clauses)

        query = f"SELECT {self.selected_columns} FROM {self.table_name}"
        if where_clause:
            query += f" {where_clause}"
        if self.group_by_clause:
            query += f" {self.group_by_clause}"
        if self.order_by_clause:
            query += f" {self.order_by_clause}"
        if self.limit_clause:
            query += f" {self.limit_clause}"

        return query, tuple(params)


    # INSERT Operations
    def insert(self, data: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
        """ Generates an INSERT query. """
        for key, value in data.items():
            self._validate_column(key)
            self._validate_value(key, value)
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
        return query, tuple(data.values())

    def insert_batch(self, data_list: List[Dict[str, Any]]) -> Tuple[str, List[Tuple[Any, ...]]]:
        """ Generates a batch INSERT query. """
        if not data_list:
            raise ValueError("Data list cannot be empty for batch insert.")

        columns = ", ".join(data_list[0].keys())
        placeholders = ", ".join(["?"] * len(data_list[0]))
        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
        params_list = [tuple(data.values()) for data in data_list]

        return query, params_list

    # UPDATE Operations
    def update(self, filters: Dict[str, Any], updates: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
        """ Generates an UPDATE query with WHERE conditions. """
        for key, value in updates.items():
            self._validate_column(key)
            self._validate_value(key, value)
        for key, value in filters.items():
            self._validate_column(key)
            self._validate_value(key, value)

        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        where_clause = " AND ".join([f"{key} = ?" for key in filters.keys()])
        query = f"UPDATE {self.table_name} SET {set_clause} WHERE {where_clause}"
        params = tuple(updates.values()) + tuple(filters.values())
        return query, params

    def bulk_update(self, updates_list: List[Dict[str, Any]], filters_list: List[Dict[str, Any]]) -> List[Tuple[str, Tuple[Any, ...]]]:
        """ Generates a batch UPDATE query for multiple updates. """
        queries_and_params = []
        for updates, filters in zip(updates_list, filters_list):
            queries_and_params.append(self.update(filters, updates))
        return queries_and_params

    # DELETE Operation
    def delete(self, filters: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
        """ Generates a DELETE query with WHERE conditions. """
        for key, value in filters.items():
            self._validate_column(key)
            self._validate_value(key, value)
        where_clause = " AND ".join([f"{key} = ?" for key in filters.keys()])
        query = f"DELETE FROM {self.table_name} WHERE {where_clause}"
        return query, tuple(filters.values())

    # Aggregation Operations
    def aggregate(self, function: str, column: str) -> Tuple[str, Tuple[Any, ...]]:
        """ Generates an aggregation query (SUM, AVG, MIN, MAX). """
        self._validate_column(column)
        query = f"SELECT {function}({column}) FROM {self.table_name}"
        return query, ()

    def sum(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        """ SUM aggregation. """
        return self.aggregate("SUM", column)

    def avg(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        """ AVG aggregation. """
        return self.aggregate("AVG", column)

    def min(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        """ MIN aggregation. """
        return self.aggregate("MIN", column)

    def max(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        """ MAX aggregation. """
        return self.aggregate("MAX", column)
