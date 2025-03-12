import asyncio
import logging
from functools import lru_cache
import threading
from concurrent.futures import Future
from typing import Callable, List, Optional, Tuple

# Configure logging. In production, configure handlers as needed.
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

class GlobalQueueManager:
    def __init__(self, max_queue_size: int = 10, num_workers: int = 3, auto_start: bool = True):
        self._max_queue_size = max_queue_size
        self._num_workers = num_workers
        self.worker_tasks: List[asyncio.Task] = []
        self.running = True
        self.job_counter = 0  # Unique job ID generator
        self.pending_tasks = {}  # Mapping from job_id to its concurrent.futures.Future
        self._lock = threading.Lock()  # Protects job_counter and pending_tasks

        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.loop_thread: Optional[threading.Thread] = None
        self.queue: Optional[asyncio.Queue] = None  # Will be created on the manager's loop

        logger.info(f"[INIT] GlobalQueueManager initialized with max_queue_size={max_queue_size}, num_workers={num_workers}")

        if auto_start:
            try:
                # Try to get the current running loop.
                self.loop = asyncio.get_running_loop()
                self.queue = asyncio.Queue(maxsize=max_queue_size)
                logger.info("[AUTO START] Found a running event loop. Auto-starting workers.")
                asyncio.create_task(self.start())
            except RuntimeError:
                # No running event loop; create one in a background thread.
                logger.info("[AUTO START] No running event loop found. Creating a new event loop in a background thread.")
                self.loop = asyncio.new_event_loop()
                def init_queue():
                    self.queue = asyncio.Queue(maxsize=max_queue_size)
                self.loop.call_soon_threadsafe(init_queue)
                self.loop_thread = threading.Thread(target=self._run_loop, args=(self.loop,), daemon=True)
                self.loop_thread.start()
                asyncio.run_coroutine_threadsafe(self.start(), self.loop)
                logger.info("[AUTO START] Workers auto-start scheduled in background event loop.")

    def _run_loop(self, loop: asyncio.AbstractEventLoop):
        asyncio.set_event_loop(loop)
        loop.run_forever()

    async def start(self):
        """Starts the worker tasks on the manager's loop."""
        self.running = True
        logger.info(f"[START] Starting {self._num_workers} worker(s)")
        for i in range(self._num_workers):
            task = asyncio.create_task(self.worker(i))
            self.worker_tasks.append(task)
            logger.info(f"[START] Worker {i} started")
        logger.info("[START] All worker(s) started.")

    async def worker(self, worker_id: int):
        """Worker that continuously pulls tasks from the queue and processes them."""
        logger.info(f"[WORKER-{worker_id}] Running")
        while self.running:
            try:
                # Retrieve a task from the queue.
                job_id, func, args, kwargs, cfut = await self.queue.get()
                logger.debug(f"[WORKER-{worker_id}] Fetched job {job_id} from queue")
                with self._lock:
                    self.pending_tasks.pop(job_id, None)
                if cfut.cancelled():
                    logger.debug(f"[WORKER-{worker_id}] Skipping cancelled job {job_id}")
                    continue
                logger.debug(f"[WORKER-{worker_id}] Processing job {job_id}")
                try:
                    if asyncio.iscoroutinefunction(func):
                        result = await func(*args, **kwargs)
                    else:
                        result = await asyncio.to_thread(func, *args, **kwargs)
                except Exception as e:
                    logger.exception(f"[WORKER-{worker_id}] Job {job_id} encountered an error:")
                    cfut.set_exception(e)
                else:
                    try:
                        cfut.set_result(result)
                    except Exception as e:
                        # If the future is cancelled, you can safely ignore or log the error.
                        if cfut.cancelled():
                            print(f"Job {job_id} result not set because the future was cancelled.")
                        else:
                            raise e

                    logger.debug(f"[WORKER-{worker_id}] Finished job {job_id} with result: {result}")
            except asyncio.CancelledError:
                logger.info(f"[WORKER-{worker_id}] Cancelled")
                break
            except Exception as e:
                logger.exception(f"[WORKER-{worker_id}] Unexpected error:")

    async def stop(self):
        """Stops all worker tasks."""
        logger.info("[STOP] Stopping GlobalQueueManager")
        self.running = False
        for task in self.worker_tasks:
            task.cancel()
            logger.debug(f"[STOP] Cancelled worker task {task}")
        await asyncio.gather(*self.worker_tasks, return_exceptions=True)
        self.worker_tasks.clear()
        logger.info("[STOP] GlobalQueueManager stopped.")

    def submit_task_sync(
        self, 
        func: Callable, 
        *args, 
        caller_loop: asyncio.AbstractEventLoop,  # Passed from the caller
        **kwargs
    ) -> Tuple[int, asyncio.Future]:
        """
        Synchronously submits a task to the manager.
        Creates a thread‑safe concurrent.futures.Future, schedules the task to be enqueued, 
        and wraps the future with asyncio.wrap_future so it’s attached to the caller's event loop.
        """
        cfut = Future()
        with self._lock:
            job_id = self.job_counter
            self.job_counter += 1
            self.pending_tasks[job_id] = cfut
        logger.debug(f"[SUBMIT] Submitting job {job_id}")
        try:
            # Directly use put_nowait to reduce overhead.
            self.loop.call_soon_threadsafe(self.queue.put_nowait, (job_id, func, args, kwargs, cfut))
        except Exception as e:
            logger.exception(f"[SUBMIT] Failed to submit job {job_id}:")
            raise e
        logger.debug(f"[SUBMIT] Job {job_id} submitted to the queue")
        wrapped_future = asyncio.wrap_future(cfut, loop=caller_loop)
        return job_id, wrapped_future

    async def submit_task(self, func: Callable, *args, **kwargs) -> Tuple[int, asyncio.Future]:
        """
        Asynchronous interface to submit a task.
        Captures the caller's event loop and wraps the synchronous submit_task_sync via asyncio.to_thread.
        """
        caller_loop = asyncio.get_running_loop()
        return await asyncio.to_thread(self.submit_task_sync, func, *args, caller_loop=caller_loop, **kwargs)

@lru_cache
def get_llm_manager():
    return GlobalQueueManager(max_queue_size=20, num_workers=5)
