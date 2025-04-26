import json
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from sqlite3 import Error as SQLiteError
import traceback
import logging
from pydantic_core import ValidationError
from starlette.middleware.base import BaseHTTPMiddleware

from constants import STUDY_DATABASE_PATH
from database.error_table import ErrorLogRepository
from errors.credential_errors import CredentialError, InvalidCredentialError, MissingCredentialError
from errors.database_errors import (
    QueryExecutionError, RecordNotFoundError, InsertError, UpdateError, DeleteError
)
from errors.llm_errors import ConfigurationError, EmbeddingsInitializationError, InvalidModelFormatError, LLMInitializationError, UnsupportedModelError, UnsupportedProviderError
from errors.ollama_errors import InvalidModelError, OllamaError, PullModelError, DeleteModelError
from errors.request_errors import RequestError
from errors.vertex_ai_errors import InvalidGenAIModelError, InvalidTextEmbeddingError, VertexAIError
from models.table_dataclasses import ErrorLog

logging.basicConfig(level=logging.ERROR, format="%(asctime)s - %(levelname)s - %(message)s")

EXCEPTION_HANDLERS = {
    HTTPException: lambda e: (e.status_code, e.detail),
    ValidationError: lambda e: (422, e.errors()),
    ValueError: lambda e: (400, f"Invalid input: {str(e)}"),
    KeyError: lambda e: (400, f"Missing key: {str(e)}"),
    TypeError: lambda e: (422, f"Type error: {str(e)}"),
    SQLiteError: lambda e: (500, f"Database error: {str(e)}"),

    QueryExecutionError: lambda e: (500, f"Query execution failed: {str(e)}"),
    RecordNotFoundError: lambda e: (404, f"Record not found: {str(e)}"),
    InsertError: lambda e: (500, f"Insert operation failed: {str(e)}"),
    UpdateError: lambda e: (500, f"Update operation failed: {str(e)}"),
    DeleteError: lambda e: (500, f"Delete operation failed: {str(e)}"),

    InvalidCredentialError: lambda e: (401, f"Invalid credentials: {str(e)}"),
    MissingCredentialError: lambda e: (400, f"Missing credentials: {str(e)}"),
    CredentialError: lambda e: (400, f"Invalid or missing credentials: {str(e)}"),

    InvalidModelError: lambda e: (404, f"Invalid model: {str(e)}"),
    PullModelError: lambda e: (500, f"Pull error: {str(e)}"),
    DeleteModelError: lambda e: (500, f"Delete operation failed: {str(e)}"),
    OllamaError: lambda e: (500, f"Ollama error: {str(e)}"),

    InvalidGenAIModelError: lambda e: (404, f"Invalid model: {str(e)}"),
    InvalidTextEmbeddingError: lambda e: (404, f"Text embedding error: {str(e)}"),
    VertexAIError: lambda e: (500, f"Vertex AI error: {str(e)}"),
    
    UnsupportedProviderError: lambda e: (400, f"Unsupported provider: {str(e)}"),
    UnsupportedModelError: lambda e: (400, f"Unsupported model: {str(e)}"),
    InvalidModelFormatError: lambda e: (400, f"Invalid model format: {str(e)}"),
    LLMInitializationError: lambda e: (500, f"LLM initialization failed: {str(e)}"),
    EmbeddingsInitializationError: lambda e: (500, f"Embeddings initialization failed: {str(e)}"),
    ConfigurationError: lambda e: (500, f"Configuration error: {str(e)}"),

    FileNotFoundError: lambda e: (500, f"File not found: {str(e)}"),
    PermissionError: lambda e: (500, f"Permission denied: {str(e)}"),
    MemoryError: lambda e: (500, f"Out of memory: {str(e)}"),
    RuntimeError: lambda e: (500, f"Runtime error: {str(e)}"),
    OSError: lambda e: (500, f"OS error: {str(e)}"),

    RequestError: lambda e: (e.status_code, e.message),
}

error_log_repository = ErrorLogRepository(database_path = STUDY_DATABASE_PATH)

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            exception_type = type(e)
            print(f"Exception type: {exception_type.__name__}")
            if exception_type in EXCEPTION_HANDLERS:
                status_code, error_message = EXCEPTION_HANDLERS[exception_type](e)
                print(f"Handling exception: {exception_type.__name__} - {str(e)}, status_code: {status_code}, error_message: {error_message}")
                logging.error(f"{exception_type.__name__}: {str(e)}")
                traceback.print_exc()
                error_log_repository.insert(
                    ErrorLog(
                        type = exception_type.__name__,
                        message = str(e),
                        context = json.dumps({
                            "route": request.url.path
                        }),
                        traceback=traceback.format_exc()
                    )
                )
                return JSONResponse(
                    status_code=status_code,
                    content={"error": exception_type.__name__, "error_message": error_message}
                )
            else:
                logging.critical(f"Unhandled exception: {str(e)}")
                traceback.print_exc()
                error_log_repository.insert(
                    ErrorLog(
                        type = "UnhandledException",
                        message = str(e),
                        context = json.dumps({
                            "route": request.url.path
                        }),
                        traceback=traceback.format_exc()
                    )
                )
                return JSONResponse(
                    status_code=500,
                    content={"error": exception_type.__name__, "error_message": "Internal server error"}
                )