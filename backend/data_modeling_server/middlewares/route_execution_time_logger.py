import time
import asyncio
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from utils.logger import Logger 

logger = Logger()

class ExecutionTimeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter() 
        response = await call_next(request)
        end_time = time.perf_counter() 

        execution_time = end_time - start_time
        log_message = f"Request {request.method} {request.url.path} executed in {execution_time:.4f} seconds"

        try:
            asyncio.get_running_loop().create_task(logger.time(log_message))
        except RuntimeError:
            asyncio.run(logger.time(log_message))

        return response
