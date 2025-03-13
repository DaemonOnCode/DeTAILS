from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlite3 import Error as SQLiteError
import traceback
import logging
from starlette.middleware.base import BaseHTTPMiddleware

from errors.credential_errors import CredentialError, InvalidCredentialError, MissingCredentialError
from errors.database_errors import (
    QueryExecutionError, RecordNotFoundError, InsertError, UpdateError, DeleteError
)
from errors.ollama_errors import InvalidModelError, OllamaError, PullModelError, DeleteModelError

logging.basicConfig(level=logging.ERROR, format="%(asctime)s - %(levelname)s - %(message)s")

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response

        except HTTPException as e:
            return JSONResponse(status_code=e.status_code, content={"error": e.__class__.__name__, "error_message": e.detail})

        except ValidationError as e:
            errors = e.errors()
            traceback.print_exc()
            return JSONResponse(status_code=422, content={"error": e.__class__.__name__,"error_message": errors})

        except ValueError as e:
            logging.error(f"ValueError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=400, content={"error": e.__class__.__name__,"error_message": f"Invalid input: {str(e)}"})

        except KeyError as e:
            logging.error(f"KeyError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=400, content={"error":e.__class__.__name__,"error_message": f"Missing key: {str(e)}"})

        except TypeError as e:
            logging.error(f"TypeError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=422, content={"error":e.__class__.__name__,"error_message": f"Type error: {str(e)}"})

        except SQLiteError as e:
            logging.error(f"SQLiteError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Database error: {str(e)}"})

        except QueryExecutionError as e:
            logging.error(f"QueryExecutionError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Query execution failed: {str(e)}"})

        except RecordNotFoundError as e:
            logging.warning(f"RecordNotFoundError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=404, content={"error":e.__class__.__name__,"error_message": f"Record not found: {str(e)}"})

        except InsertError as e:
            logging.error(f"InsertError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Insert operation failed: {str(e)}"})

        except UpdateError as e:
            logging.error(f"UpdateError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Update operation failed: {str(e)}"})

        except DeleteError as e:
            logging.error(f"DeleteError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Delete operation failed: {str(e)}"})
        
        except InvalidCredentialError as e:
            logging.error(f"InvalidCredentialError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=401, content={"error":e.__class__.__name__,"error_message": f"Invalid credentials: {str(e)}"})
        
        except MissingCredentialError as e:
            logging.error(f"MissingCredentialError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=400, content={"error":e.__class__.__name__,"error_message": f"Missing credentials: {str(e)}"})
        
        except CredentialError as e:
            logging.error(f"CredentialError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=400, content={"error":e.__class__.__name__,"error_message": f"Invalid or Missing credentials: {str(e)}"})
        
        except InvalidModelError as e:
            logging.error(f"InvalidModelError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=404, content={"error":e.__class__.__name__,"error_message": f"Invalid model: {str(e)}"})
        
        except PullModelError as e:
            logging.error(f"PullModelError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Pull error: {str(e)}"})

        except DeleteModelError as e:
            logging.error(f"DeleteModelError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Delete operation failed: {str(e)}"})

        except OllamaError as e:
            logging.error(f"OllamaError: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": f"Ollama error: {str(e)}"})
        

        except Exception as e:
            logging.critical(f"Unhandled exception: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error":e.__class__.__name__,"error_message": "Internal server error. Please check logs for errors."})
