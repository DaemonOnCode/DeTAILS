import functools
import asyncio
import inspect
from typing import Optional
from utils.logger import Logger 

# Create a global logger instance
logger = Logger()

def log_exceptions(custom_logger: Optional[Logger] = None):
    """Decorator to log exceptions of a FastAPI route using the custom async Logger."""
    def decorator(func):
        @functools.wraps(func)  # Preserve function metadata for FastAPI
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)  # Execute the actual FastAPI route
            except Exception as e:
                log_instance = custom_logger or logger
                error_message = f"Error in '{func.__name__}': {str(e)}"
                await log_instance.error(error_message)
                raise  # Re-raise the exception after logging

        @functools.wraps(func)  # Preserve function metadata for FastAPI
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)  # Execute the actual FastAPI route
            except Exception as e:
                log_instance = custom_logger or logger
                error_message = f"Error in '{func.__name__}': {str(e)}"

                # Run the async logging function in a new event loop
                try:
                    asyncio.get_running_loop().create_task(log_instance.error(error_message))
                except RuntimeError:
                    # If no running event loop exists, create a new one
                    asyncio.run(log_instance.error(error_message))

                raise  # Re-raise the exception after logging

        # Ensure FastAPI sees the correct function signature
        wrapped_func = async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        wrapped_func.__signature__ = inspect.signature(func)  # Explicitly copy signature

        return wrapped_func

    return decorator
