from typing import Optional, TypeVar, Generic, Tuple, Any, List, Dict, get_type_hints
from dataclasses import fields
from datetime import datetime

T = TypeVar("T")  # Represents the dataclass

# SQLite type mapping
SQLITE_TYPE_MAPPING = {
    str: "TEXT",
    int: "INTEGER",
    float: "REAL",
    bytes: "BLOB",
    datetime: "TIMESTAMP",
    type(None): "NULL",  # For optional fields
}


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

    def _validate_column(self, column: str) -> None:
        """
        Validates that the column exists in the dataclass.

        :param column: Column name to validate.
        :raises ValueError: If the column does not exist in the dataclass.
        """
        if column not in self.model_fields:
            raise ValueError(f"Invalid column: {column}. Allowed columns: {list(self.model_fields.keys())}")

    def _validate_value(self, column: str, value: Any) -> None:
        """
        Validates that the value matches the type of the column in the dataclass.

        :param column: Column name.
        :param value: Value to validate.
        :raises TypeError: If the value type does not match the column type.
        """
        expected_type = self.model_fields[column]
        if not isinstance(value, expected_type) and value is not None:
            raise TypeError(
                f"Invalid type for column '{column}'. Expected {expected_type}, got {type(value)}."
            )

    # SELECT Operations
    def where(self, column: str, value: Any, operator: str = "=") -> "QueryBuilder[T]":
        """
        Adds a WHERE condition to the query.

        :param column: Column name.
        :param value: Value to filter by.
        :param operator: SQL operator (default: "=").
        :return: The current QueryBuilder instance.
        """
        self._validate_column(column)
        self._validate_value(column, value)
        self.filters.append((column, operator, value))
        return self

    def order_by(self, column: str, descending: bool = False) -> "QueryBuilder[T]":
        """
        Adds an ORDER BY clause to the query.

        :param column: Column name.
        :param descending: Whether to order in descending order.
        :return: The current QueryBuilder instance.
        """
        self._validate_column(column)
        direction = "DESC" if descending else "ASC"
        self.order_by_clause = f"ORDER BY {column} {direction}"
        return self

    def limit(self, count: int) -> "QueryBuilder[T]":
        """
        Adds a LIMIT clause to the query.

        :param count: Maximum number of rows to return.
        :return: The current QueryBuilder instance.
        """
        self.limit_clause = f"LIMIT {count}"
        return self

    def build(self) -> Tuple[str, Tuple[Any, ...]]:
        """
        Constructs the SQL query and parameters.

        :return: A tuple of (query, params).
        """
        where_clause = ""
        params = []

        if self.filters:
            clauses = []
            for column, operator, value in self.filters:
                clauses.append(f"{column} {operator} ?")
                params.append(value)
            where_clause = "WHERE " + " AND ".join(clauses)

        query = f"SELECT * FROM {self.table_name}"
        if where_clause:
            query += f" {where_clause}"
        if self.order_by_clause:
            query += f" {self.order_by_clause}"
        if self.limit_clause:
            query += f" {self.limit_clause}"

        return query, tuple(params)
    
    def select(self, *columns: str) -> "QueryBuilder[T]":
        """
        Specifies the columns to select.

        :param columns: Column names to select.
        :return: The current QueryBuilder instance.
        """
        for column in columns:
            self._validate_column(column)
        self.columns = ", ".join(columns)
        return self
    
    def find(self, filters: Optional[Dict[str, Any]] = None) -> Tuple[str, Tuple[Any, ...]]:
        """
        Generates a SELECT query with optional WHERE conditions.

        :param filters: Optional dictionary of filter conditions.
        :return: Tuple containing the SQL query and the parameters.
        """
        where_clause = ""
        params = []

        if filters:
            clauses = []
            for column, value in filters.items():
                self._validate_column(column)
                self._validate_value(column, value)
                clauses.append(f"{column} = ?")
                params.append(value)
            where_clause = "WHERE " + " AND ".join(clauses)

        selected_columns = getattr(self, "columns", "*")  # Defaults to "*" if not set by select()
        query = f"SELECT {selected_columns} FROM {self.table_name}"
        if where_clause:
            query += f" {where_clause}"

        return query, tuple(params)


    # INSERT Operation
    def insert(self, data: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
        for key, value in data.items():
            self._validate_column(key)
            self._validate_value(key, value)
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
        return query, tuple(data.values())

    # UPDATE Operation
    def update(self, filters: Dict[str, Any], updates: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
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

    # DELETE Operation
    def delete(self, filters: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
        for key, value in filters.items():
            self._validate_column(key)
            self._validate_value(key, value)
        where_clause = " AND ".join([f"{key} = ?" for key in filters.keys()])
        query = f"DELETE FROM {self.table_name} WHERE {where_clause}"
        return query, tuple(filters.values())
