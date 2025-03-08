import json
import time
from uuid import uuid4
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import Message

from constants import LOG_FILE


def write_log(entry: dict):
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_id = str(uuid4()) 
        
        request_body_bytes = await request.body()
        try:
            request_body_text = request_body_bytes.decode("utf-8")
        except UnicodeDecodeError:
            request_body_text = str(request_body_bytes)

        request_log = {
            "request_id": request_id,
            "timestamp": time.time(),
            "event": "request",
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "body": request_body_text if request_body_text else None,
        }
        write_log(request_log)

        response = await call_next(request)
        process_time = time.time() - start_time

        response_body_bytes = b""
        if hasattr(response, "body") and response.body is not None:
            response_body_bytes = response.body
        else:
            async for chunk in response.body_iterator:
                response_body_bytes += chunk
            response = Response(
                content=response_body_bytes,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

        try:
            response_body_text = response_body_bytes.decode("utf-8")
        except Exception:
            response_body_text = str(response_body_bytes)

        response_log = {
            "request_id": request_id,  
            "timestamp": time.time(),
            "event": "response",
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": response_body_text if response_body_text else None,
            "process_time": process_time,
        }
        write_log(response_log)
        return response