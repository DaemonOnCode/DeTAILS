from enum import Enum
import os
import re
import sqlite3
from dataclasses import fields
from datetime import datetime

from data_modeling_server.constants import DATABASE_PATH, STUDY_DATABASE_PATH, DATABASE_DIR
from database.constants import SQLITE_TYPE_MAPPING

def camel_to_snake(name: str) -> str:
    name = name.replace("Repository", "")
    return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()

def generate_create_table_statement(dataclass_obj):
    table_name = camel_to_snake(dataclass_obj.__name__)
    columns = []
    primary_keys = []
    foreign_keys = []
    
    for field in fields(dataclass_obj.model):
        if field.metadata.get("primary_key"):
            primary_keys.append(field.name)

    for field in fields(dataclass_obj.model):
        column_name = field.name

        if isinstance(field.type, type) and issubclass(field.type, Enum):
            column_type = "TEXT"
            enum_names = [f"'{member.name}'" for member in field.type]
            check_constraint = f"CHECK ({column_name} IN ({', '.join(enum_names)}))"
            constraints = [check_constraint]
        else:
            column_type = SQLITE_TYPE_MAPPING.get(field.type, "TEXT")
            constraints = []

        if field.metadata.get("not_null", False):
            constraints.append("NOT NULL")

        if field.default is not None and field.default is not field.default_factory:
            if isinstance(field.default, Enum):
                constraints.append(f"DEFAULT '{field.default.name}'")
            elif isinstance(field.default, str):
                constraints.append(f"DEFAULT '{field.default}'")
            elif isinstance(field.default, (int, float, bool)):
                default_value = 1 if isinstance(field.default, bool) and field.default else field.default
                constraints.append(f"DEFAULT {default_value}")
        elif callable(field.default_factory):
            if field.default_factory == datetime.now:
                constraints.append("DEFAULT CURRENT_TIMESTAMP")

        if column_name in primary_keys:
            if len(primary_keys) == 1:
                if field.metadata.get("auto_increment", False) and column_type == "INTEGER":
                    column_definition = f"{column_name} INTEGER PRIMARY KEY AUTOINCREMENT"
                else:
                    column_definition = f"{column_name} {column_type} PRIMARY KEY {' '.join(constraints)}".strip()
            else:
                column_definition = f"{column_name} {column_type} {' '.join(constraints)}".strip()
        else:
            column_definition = f"{column_name} {column_type} {' '.join(constraints)}".strip()

        columns.append(column_definition)

        if "foreign_key" in field.metadata:
            ref_table, ref_column = field.metadata["foreign_key"].split("(")
            ref_column = ref_column.strip(")")
            foreign_keys.append(
                f"FOREIGN KEY ({column_name}) REFERENCES {ref_table}({ref_column}) ON DELETE CASCADE"
            )

    primary_key_clause = f", PRIMARY KEY ({', '.join(primary_keys)})" if len(primary_keys) > 1 else ""
    foreign_key_clause = ", " + ", ".join(foreign_keys) if foreign_keys else ""

    return f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)}{primary_key_clause}{foreign_key_clause});"

def initialize_database(dataclasses):
    os.makedirs(os.path.dirname(DATABASE_DIR), exist_ok=True)
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        for dataclass_obj in dataclasses:
            print(f"Initializing table for {dataclass_obj.__name__}...")
            create_statement = generate_create_table_statement(dataclass_obj)
            cursor.execute(create_statement)
            print(f"Table for {dataclass_obj.__name__} initialized!")
        conn.commit()

def initialize_study_database(dataclasses):
    os.makedirs(os.path.dirname(DATABASE_DIR), exist_ok=True)
    with sqlite3.connect(STUDY_DATABASE_PATH) as conn:
        cursor = conn.cursor()
        for dataclass_obj in dataclasses:
            print(f"Initializing table for {dataclass_obj.__name__}...")
            create_statement = generate_create_table_statement(dataclass_obj)
            cursor.execute(create_statement)
            print(f"Table for {dataclass_obj.__name__} initialized!")
        conn.commit()