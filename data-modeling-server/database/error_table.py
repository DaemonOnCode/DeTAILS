from typing import List

from models import ErrorLog
from .base_class import BaseRepository
from models import ErrorLog

class ErrorLogRepository(BaseRepository[ErrorLog]):
    model = ErrorLog
    def __init__(self, *args, **kwargs):
        super().__init__("error_log", ErrorLog, *args, **kwargs)
    

