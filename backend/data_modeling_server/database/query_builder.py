from typing import Optional, TypeVar, Generic, Tuple, Any, List, Dict
from dataclasses import fields

T = TypeVar("T")


class QueryBuilder(Generic[T]):
    def __init__(self, table_name: str, model: T):
        self.table_name = table_name
        self.model_fields = {field.name: field.type for field in fields(model)}
        self.filters: List[Tuple[str, str, Any]] = []
        self.order_by_clause = ""
        self.limit_clause = ""
        self.group_by_clause = ""
        self.selected_columns = "*"
        self.offset_clause = ""

    def _validate_column(self, column: str) -> None:
        if column != "*" and column not in self.model_fields:
            raise ValueError(f"Invalid column: {column}. Allowed columns: {list(self.model_fields.keys())}")

    def _validate_value(self, column: str, value: Any) -> None:
        expected_type = self.model_fields[column]
        if expected_type == bool:
            if not isinstance(value, (bool, int)):
                raise TypeError(f"Invalid type for column '{column}'. Expected bool, got {type(value)}.")
        elif expected_type == Optional[bool]:
            if not isinstance(value, (bool, int, type(None))):
                raise TypeError(f"Invalid type for column '{column}'. Expected Optional[bool], got {type(value)}.")
        if not isinstance(value, expected_type) and value is not None:
            raise TypeError(f"Invalid type for column '{column}'. Expected {expected_type}, got {type(value)}.")
        
    def _normalize_value(self, column: str, value: Any) -> Any:
        expected = self.model_fields[column]
        if (expected is bool) and isinstance(value, int):
            return bool(value)
        elif (expected is Optional[bool]) and isinstance(value, int):
            return bool(value) if value is not None else None
        return value

    def _format_filter(self, column: str, operator: str, value: Any) -> Tuple[str, List[Any]]:
        self._validate_column(column)
        value = self._normalize_value(column, value)
        if value is None:
            if operator == '=':
                return f"{column} IS NULL", []
            elif operator == '!=':
                return f"{column} IS NOT NULL", []
            else:
                raise ValueError(f"Cannot use operator {operator} with None")
        elif isinstance(value, list):
            if operator.upper() not in ('IN', 'NOT IN'):
                raise ValueError(f"Operator {operator} cannot be used with a list")
            if not value:
                raise ValueError(f"List for {column} cannot be empty")
            normalized = []
            for val in value:
                val = self._normalize_value(column, val)
                self._validate_value(column, val)
                normalized.append(val)
            placeholders = ', '.join('?' * len(normalized))
            return f"{column} {operator} ({placeholders})", normalized
        else:
            self._validate_value(column, value)
            return f"{column} {operator} ?", [value]

    def reset(self) -> "QueryBuilder[T]":
        self.filters = []
        self.order_by_clause = ""
        self.limit_clause = ""
        self.group_by_clause = ""
        self.selected_columns = "*"
        self.offset_clause = ""
        return self

    def offset(self, offset: int) -> "QueryBuilder[T]":
        if offset < 0:
            raise ValueError("Offset cannot be negative.")
        self.offset_clause = f"OFFSET {offset}"
        return self

    def where(self, column: str, value: Any, operator: str = "=") -> "QueryBuilder[T]":
        if operator not in ("=", "!=", ">", "<", ">=", "<=", "IN", "NOT IN"):
            raise ValueError(f"Invalid operator: {operator}")
        self._validate_column(column)
        # normalize & validate here as well
        if value is not None:
            if isinstance(value, list):
                if operator.upper() not in ('IN', 'NOT IN'):
                    raise ValueError(f"Operator {operator} cannot be used with a list")
                if not value:
                    raise ValueError(f"List for {column} cannot be empty")
                value = [self._normalize_value(column, v) for v in value]
                for v in value:
                    self._validate_value(column, v)
            else:
                value = self._normalize_value(column, value)
                self._validate_value(column, value)
        else:
            if operator == '=':
                operator = 'IS'
            elif operator == '!=':
                operator = 'IS NOT'
            else:
                raise ValueError(f"Cannot use operator {operator} with None")
        self.filters.append((column, operator, value))
        return self

    def order_by(self, column: str, descending: bool = False) -> "QueryBuilder[T]":
        self._validate_column(column)
        direction = "DESC" if descending else "ASC"
        if self.order_by_clause:
            self.order_by_clause += f", {column} {direction}"
        else:
            self.order_by_clause = f"ORDER BY {column} {direction}"
        return self

    def limit(self, count: int) -> "QueryBuilder[T]":
        self.limit_clause = f"LIMIT {count}"
        return self

    def select(self, *columns: str) -> "QueryBuilder[T]":
        for column in columns:
            self._validate_column(column)
        self.selected_columns = ", ".join(columns)
        return self

    def group_by(self, column: str) -> "QueryBuilder[T]":
        self._validate_column(column)
        self.group_by_clause = f"GROUP BY {column}"
        return self

    def find(self, filters: Optional[Dict[str, Any]] = None) -> Tuple[str, Tuple[Any, ...]]:
        filters = filters or {}
        clauses = []
        params = []
        for column, value in filters.items():
            if isinstance(value, list):
                clause, p = self._format_filter(column, 'IN', value)
            else:
                clause, p = self._format_filter(column, '=', value)
            clauses.append(clause)
            params.extend(p)
        for column, operator, value in self.filters:
            clause, p = self._format_filter(column, operator, value)
            clauses.append(clause)
            params.extend(p)
        where_clause = "WHERE " + " AND ".join(clauses) if clauses else ""
        query = f"SELECT {self.selected_columns} FROM {self.table_name} {where_clause} {self.group_by_clause} {self.order_by_clause}"
        if self.limit_clause and self.offset_clause:
            query += f" {self.limit_clause} {self.offset_clause}"
        elif self.limit_clause:
            query += f" {self.limit_clause}"
        elif self.offset_clause:
            query += f" LIMIT -1 {self.offset_clause}"

        print(f"Generated SQL Query: {query}", params)
        return query, tuple(params)

    def count(self, filters: Optional[Dict[str, Any]] = None) -> Tuple[str, Tuple[Any, ...]]:
        query, params = self.find(filters)
        count_query = query.replace(f"SELECT {self.selected_columns}", "SELECT COUNT(*)")
        return count_query, params

    def insert(self, data: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
        for key, value in data.items():
            self._validate_column(key)
            value = self._normalize_value(key, value)
            self._validate_value(key, value)
            data[key] = value
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
        return query, tuple(data.values())

    def insert_batch(self, data_list: List[Dict[str, Any]]) -> Tuple[str, List[Tuple[Any, ...]]]:
        if not data_list:
            raise ValueError("Data list cannot be empty for batch insert.")
        keys = list(data_list[0].keys())
        for row in data_list:
            if list(row.keys()) != keys:
                raise ValueError("All dictionaries in data_list must have the same keys.")

            # 2) normalize & validate each value
            for key in keys:
                self._validate_column(key)
                val = self._normalize_value(key, row[key])
                self._validate_value(key, val)
                row[key] = val

        # 3) build SQL
        columns = ", ".join(keys)
        placeholders = ", ".join("?" for _ in keys)
        query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders})"
        # 4) collect params in consistent key order
        params_list = [tuple(row[k] for k in keys) for row in data_list]
        return query, params_list

    def update(self, filters: Dict[str, Any], updates: Dict[str, Any]) -> Tuple[str, Tuple[Any, ...]]:
        for key, value in updates.items():
            self._validate_column(key)
            value = self._normalize_value(key, value)
            self._validate_value(key, value)
            updates[key] = value
        set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
        clauses = []
        params = []
        for column, value in filters.items():
            if isinstance(value, list):
                clause, p = self._format_filter(column, 'IN', value)
            else:
                clause, p = self._format_filter(column, '=', value)
            clauses.append(clause)
            params.extend(p)
        where_clause = " AND ".join(clauses)
        query = f"UPDATE {self.table_name} SET {set_clause} WHERE {where_clause}"
        update_params = list(updates.values()) + params
        return query, tuple(update_params)

    def delete(self, filters: Dict[str, Any], all=False) -> Tuple[str, Tuple[Any, ...]]:
        if not filters and not all:
            raise ValueError("Filters are required for delete operation to prevent accidental deletion of all records.")
        if all:
            query = f"DELETE FROM {self.table_name}"
            return query, ()
        clauses = []
        params = []
        for column, value in filters.items():
            if isinstance(value, list):
                clause, p = self._format_filter(column, 'IN', value)
            else:
                clause, p = self._format_filter(column, '=', value)
            clauses.append(clause)
            params.extend(p)
        where_clause = " AND ".join(clauses)
        query = f"DELETE FROM {self.table_name} WHERE {where_clause}"
        return query, tuple(params)

    def aggregate(self, function: str, column: str) -> Tuple[str, Tuple[Any, ...]]:
        self._validate_column(column)
        query = f"SELECT {function}({column}) FROM {self.table_name}"
        return query, ()

    def sum(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        return self.aggregate("SUM", column)

    def avg(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        return self.aggregate("AVG", column)

    def min(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        return self.aggregate("MIN", column)

    def max(self, column: str) -> Tuple[str, Tuple[Any, ...]]:
        return self.aggregate("MAX", column)