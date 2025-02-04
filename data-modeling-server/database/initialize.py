import re
import sqlite3
from dataclasses import fields
from typing import Optional, Any, Dict
from datetime import datetime

from constants import DATABASE_PATH
from database.constants import SQLITE_TYPE_MAPPING

def camel_to_snake(name: str) -> str:
    """Convert CamelCase to snake_case."""
    name = name.replace("Repository", "")
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()


def generate_create_table_statement(dataclass_obj):
    """Generates a CREATE TABLE SQL statement from a dataclass model."""
    
    table_name = camel_to_snake(dataclass_obj.__name__)  # Convert class name to snake_case table name
    columns = []
    primary_keys = []
    foreign_keys = []

    for field in fields(dataclass_obj.model):
        column_name = field.name
        column_type = SQLITE_TYPE_MAPPING.get(field.type, "TEXT")  # Default to TEXT if type unknown
        constraints = []

        # NOT NULL constraint
        if field.metadata.get("not_null", False):
            constraints.append("NOT NULL")

        # DEFAULT value handling
        if field.default is not None and field.default is not field.default_factory:
            if isinstance(field.default, str):
                constraints.append(f"DEFAULT '{field.default}'")
            elif isinstance(field.default, (int, float, bool)):
                constraints.append(f"DEFAULT {int(field.default)}")  # Convert bool to 0/1
        elif callable(field.default_factory):  # Handle datetime.now()
            if field.default_factory == datetime.now:
                constraints.append("DEFAULT CURRENT_TIMESTAMP")

        # Handle primary key
        if field.metadata.get("primary_key"):
            primary_keys.append(column_name)

        # Handle foreign key constraints
        if "foreign_key" in field.metadata:
            ref_table, ref_column = field.metadata["foreign_key"].split("(")  # Extract table and column
            ref_column = ref_column.strip(")")
            foreign_keys.append(f"FOREIGN KEY ({column_name}) REFERENCES {ref_table}({ref_column})")

        # Construct column definition
        column_definition = f"{column_name} {column_type} {' '.join(constraints)}".strip()
        columns.append(column_definition)

    # Build PRIMARY KEY constraint (for composite keys)
    primary_key_clause = f", PRIMARY KEY ({', '.join(primary_keys)})" if primary_keys else ""

    # Build FOREIGN KEY constraints
    foreign_key_clause = ", " + ", ".join(foreign_keys) if foreign_keys else ""

    # Final SQL statement
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