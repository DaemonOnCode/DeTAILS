import time
import functools
import asyncio
import inspect
from typing import Optional
from utils.logger import Logger  # Import the fixed Logger class

# Create a global logger instance
logger = Logger()

def log_execution_time(custom_logger: Optional[Logger] = None):
    """Decorator to log execution time of a FastAPI route using the custom async Logger."""
    def decorator(func):
        @functools.wraps(func)  # Preserve function metadata for FastAPI
        async def async_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = await func(*args, **kwargs)  # Execute the actual FastAPI route
            finally:
                end_time = time.perf_counter()
                execution_time = end_time - start_time
                log_instance = custom_logger or logger
                await log_instance.time(f"Function '{func.__name__}' executed in {execution_time:.4f} seconds")
            return result  # Ensure response is returned correctly

        @functools.wraps(func)  # Preserve function metadata for FastAPI
        def sync_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)  # Execute the actual FastAPI route
            finally:
                end_time = time.perf_counter()
                execution_time = end_time - start_time
                log_instance = custom_logger or logger
                
                # Run the async logging function in a new event loop
                try:
                    asyncio.get_running_loop().create_task(
                        log_instance.time(f"Function '{func.__name__}' executed in {execution_time:.4f} seconds")
                    )
                except RuntimeError:
                    # If no running event loop exists, create a new one
                    asyncio.run(log_instance.time(f"Function '{func.__name__}' executed in {execution_time:.4f} seconds"))
                    
            return result  # Ensure response is returned correctly

        # Ensure FastAPI sees the correct function signature
        wrapped_func = async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        wrapped_func.__signature__ = inspect.signature(func)  # Explicitly copy signature

        return wrapped_func

    return decorator
