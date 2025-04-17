import time
import functools
import asyncio
import inspect
from typing import Optional
from utils.logger import Logger  

logger = Logger()

def log_execution_time(custom_logger: Optional[Logger] = None):
    def decorator(func):
        @functools.wraps(func)  
        async def async_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = await func(*args, **kwargs)  
            finally:
                end_time = time.perf_counter()
                execution_time = end_time - start_time
                log_instance = custom_logger or logger
                await log_instance.time(f"Function '{func.__name__}' executed in {execution_time:.4f} seconds")
            return result  

        @functools.wraps(func)  
        def sync_wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)  
            finally:
                end_time = time.perf_counter()
                execution_time = end_time - start_time
                log_instance = custom_logger or logger
                
                try:
                    asyncio.get_running_loop().create_task(
                        log_instance.time(f"Function '{func.__name__}' executed in {execution_time:.4f} seconds")
                    )
                except RuntimeError:
                    asyncio.run(log_instance.time(f"Function '{func.__name__}' executed in {execution_time:.4f} seconds"))
                    
            return result  
        
        wrapped_func = async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        wrapped_func.__signature__ = inspect.signature(func)  

        return wrapped_func

    return decorator
