import re
import sqlite3
from dataclasses import fields
from typing import Optional, Any, Dict
from datetime import datetime

from constants import DATABASE_PATH

SQLITE_TYPE_MAPPING = {
    str: "TEXT",
    int: "INTEGER",
    float: "REAL",
    bytes: "BLOB",
    datetime: "TIMESTAMP",
    Optional[str]: "TEXT",
    Optional[int]: "INTEGER",
    Optional[float]: "REAL",
    Optional[bytes]: "BLOB",
    Optional[datetime]: "TIMESTAMP",
}

def camel_to_snake(name: str) -> str:
    """Convert CamelCase to snake_case."""
    name = name.replace("Repository", "")
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()

def generate_create_table_statement(dataclass_obj):
    table_name = camel_to_snake(dataclass_obj.__name__)
    columns = []
    primary_keys = []
    foreign_keys = []

    for field in fields(dataclass_obj.model):
        column_name = field.name
        column_type = SQLITE_TYPE_MAPPING.get(field.type, "TEXT")
        constraints = []

        # NOT NULL constraint
        if field.metadata.get("not_null", False):
            constraints.append("NOT NULL")

        # Default value
        default_value = field.default if field.default != field.default_factory else None
        if default_value is not None:
            if isinstance(default_value, str):
                constraints.append(f"DEFAULT '{default_value}'")
            elif isinstance(default_value, (int, float)):
                constraints.append(f"DEFAULT {default_value}")
        elif field.default_factory is not None:
            if field.default_factory == datetime.now:
                constraints.append("DEFAULT CURRENT_TIMESTAMP")


        # Add primary key constraint
        if field.metadata.get("primary_key"):
            primary_keys.append(column_name)

        # Add foreign key constraint
        if "foreign_key" in field.metadata:
            foreign_keys.append(f"FOREIGN KEY ({column_name}) REFERENCES {field.metadata['foreign_key']}")

        # Combine column definition
        column_definition = f"{column_name} {column_type} {' '.join(constraints)}"
        columns.append(column_definition)

    # Combine primary key definition
    if primary_keys:
        primary_key_clause = f", PRIMARY KEY ({', '.join(primary_keys)})"
    else:
        primary_key_clause = ""

    # Combine foreign key definitions
    if foreign_keys:
        foreign_key_clause = ", " + ", ".join(foreign_keys)
    else:
        foreign_key_clause = ""

    return f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)}{primary_key_clause}{foreign_key_clause});"


def initialize_database(dataclasses):
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()

        for dataclass_obj in dataclasses:
            print(f"Initializing table for {dataclass_obj.__name__}...")
            create_statement = generate_create_table_statement(dataclass_obj)
            cursor.execute(create_statement)
            print(f"Table for {dataclass_obj.__name__} initialized!")

        conn.commit()