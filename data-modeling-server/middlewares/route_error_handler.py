from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlite3 import Error as SQLiteError
import traceback
import logging
from starlette.middleware.base import BaseHTTPMiddleware

from errors.database_errors import (
    QueryExecutionError, RecordNotFoundError, InsertError, UpdateError, DeleteError
)

logging.basicConfig(level=logging.ERROR, format="%(asctime)s - %(levelname)s - %(message)s")

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)  # Process the request
            return response

        except HTTPException as e:
            # Known HTTPException from FastAPI
            return JSONResponse(status_code=e.status_code, content={"detail": e.detail})

        except ValidationError as e:
            # Handles Pydantic validation errors
            errors = e.errors()
            traceback.print_exc()
            return JSONResponse(status_code=422, content={"validation_errors": errors})

        except ValueError as e:
            logging.error(f"ValueError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=400, content={"detail": f"Invalid input: {str(e)}"})

        except KeyError as e:
            logging.error(f"KeyError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=400, content={"detail": f"Missing key: {str(e)}"})

        except TypeError as e:
            logging.error(f"TypeError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=422, content={"detail": f"Type error: {str(e)}"})

        except SQLiteError as e:
            logging.error(f"SQLiteError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"detail": f"Database error: {str(e)}"})

        except QueryExecutionError as e:
            logging.error(f"QueryExecutionError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"detail": f"Query execution failed: {str(e)}"})

        except RecordNotFoundError as e:
            logging.warning(f"RecordNotFoundError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=404, content={"detail": f"Record not found: {str(e)}"})

        except InsertError as e:
            logging.error(f"InsertError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"detail": f"Insert operation failed: {str(e)}"})

        except UpdateError as e:
            logging.error(f"UpdateError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"detail": f"Update operation failed: {str(e)}"})

        except DeleteError as e:
            logging.error(f"DeleteError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"detail": f"Delete operation failed: {str(e)}"})

        except Exception as e:
            # Unexpected errors—log full traceback
            logging.critical(f"Unhandled exception: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"detail": "Internal server error. Please check logs for details."})
