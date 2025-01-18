import sqlite3
from dataclasses import fields
from typing import Optional, Any, Dict
from datetime import datetime

from constants import DATABASE_PATH
from database.table_data_class import *

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

def generate_create_table_statement(dataclass_obj):
    table_name = dataclass_obj.__name__.lower()
    columns = []
    primary_keys = []
    foreign_keys = []

    for field in fields(dataclass_obj):
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
            else:
                constraints.append(f"DEFAULT {default_value}")

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
            create_statement = generate_create_table_statement(dataclass_obj)
            cursor.execute(create_statement)

        conn.commit()

initialize_database([
    Workspaces, 
    WorkspaceStates, 
    Rules,
    TokenStats,
    TokenStatsDetailed,
    Models,
    Datasets, 
    Posts, 
    Comments,
    TokenizedPosts,
    TokenizedComments,
    LLMResponses
])