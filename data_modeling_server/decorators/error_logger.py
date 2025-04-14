import functools
import asyncio
import inspect
from typing import Optional
from utils.logger import Logger 

logger = Logger()

def log_exceptions(custom_logger: Optional[Logger] = None):
    def decorator(func):
        @functools.wraps(func)  
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)  
            except Exception as e:
                log_instance = custom_logger or logger
                error_message = f"Error in '{func.__name__}': {str(e)}"
                await log_instance.error(error_message)
                raise  

        @functools.wraps(func)  
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)  
            except Exception as e:
                log_instance = custom_logger or logger
                error_message = f"Error in '{func.__name__}': {str(e)}"

                try:
                    asyncio.get_running_loop().create_task(log_instance.error(error_message))
                except RuntimeError:
                    asyncio.run(log_instance.error(error_message))
                raise  
            
        wrapped_func = async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        wrapped_func.__signature__ = inspect.signature(func)  

        return wrapped_func

    return decorator
