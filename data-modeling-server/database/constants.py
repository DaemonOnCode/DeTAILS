
from datetime import datetime
from typing import Optional

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
    type(None): "NULL",
}