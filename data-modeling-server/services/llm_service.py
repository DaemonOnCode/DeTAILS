import asyncio
from datetime import datetime
from functools import lru_cache
import json
import logging
import threading
import time
from asyncio import Future
from concurrent.futures import Future as ConcurrentFuture
from typing import Callable, Dict, List, Optional, Tuple
import uuid

from database import LlmPendingTaskRepository
from models import LlmPendingTask

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

class GlobalQueueManager:
    def __init__(
        self,
        max_queue_size: int = 10,
        num_workers: int = 3,
        auto_start: bool = True,
        rate_limit_per_minute: Optional[int] = None,
        status_check_interval: float = 5.0,
        enable_status_check: bool = True
    ):
        """Initialize the GlobalQueueManager with specified parameters."""
        try:
            self._max_queue_size = max_queue_size
            self._num_workers = num_workers
            self.worker_tasks: List[asyncio.Task] = []
            self.running = False
            self.pending_tasks: Dict[str, ConcurrentFuture] = {}
            self._lock = threading.Lock()
            self.function_cache: Dict[str, Tuple[Callable, int]] = {}
            self.enable_status_check = enable_status_check
            self.status_task = None
            self.enqueue_task = None

            # Rate limiting setup
            self.rate_limit_per_minute = rate_limit_per_minute
            self.rate_limit_per_sec = rate_limit_per_minute / 60.0 if rate_limit_per_minute else None
            self.last_start_time = 0.0
            self.rate_lock = asyncio.Lock()
            self.status_check_interval = status_check_interval
            self.stop_event = asyncio.Event()

            # Event loop and queue setup
            self.loop = asyncio.new_event_loop()
            self.queue = None
            def init_queue():
                try:
                    self.queue = asyncio.Queue(maxsize=max_queue_size)
                    logger.debug("[INIT] Queue initialized in event loop")
                except Exception as e:
                    logger.error(f"[INIT] Failed to initialize queue: {e}")
            self.loop.call_soon_threadsafe(init_queue)
            self.loop_thread = threading.Thread(target=self._run_loop, args=(self.loop,), daemon=True)
            self.loop_thread.start()
            time.sleep(0.1)

            # Initialize repository
            try:
                self.pending_task_repo = LlmPendingTaskRepository()
            except Exception as e:
                logger.error(f"[INIT] Failed to initialize LlmPendingTaskRepository: {e}")
                raise

            # Clean up stray tasks
            try:
                stray_tasks = self.pending_task_repo.find(filters={"status": ["pending", "enqueued"]})
                for task in stray_tasks:
                    function_key = task.function_key
                    if function_key not in self.function_cache:
                        self.pending_task_repo.update(
                            filters={"task_id": task.task_id},
                            updates={
                                "status": "failed",
                                "error": f"System restarted, function {function_key} not found",
                                "completed_at": datetime.now()
                            }
                        )
                        logger.debug(f"[INIT] Marked stray task {task.task_id} as failed due to missing function {function_key}")
                    else:
                        logger.debug(f"[INIT] Task {task.task_id} with function {function_key} retained")
                logger.info(f"[INIT] Processed {len(stray_tasks)} stray tasks")
            except Exception as e:
                logger.error(f"[INIT] Error cleaning up stray tasks: {e}")

            if auto_start:
                try:
                    fut = asyncio.run_coroutine_threadsafe(self.start(), self.loop)
                    fut.result(timeout=5)
                    logger.info("[INIT] Start method scheduled and completed")
                except Exception as e:
                    logger.error(f"[INIT] Auto-start failed: {e}")

            logger.info(f"[INIT] GlobalQueueManager initialized: max_queue_size={max_queue_size}, num_workers={num_workers}")
        except Exception as e:
            logger.error(f"[INIT] Unexpected error during initialization: {e}")
            raise

    def _run_loop(self, loop: asyncio.AbstractEventLoop):
        """Run the event loop in a separate thread."""
        try:
            asyncio.set_event_loop(loop)
            loop.run_forever()
        except Exception as e:
            logger.error(f"[LOOP] Event loop failed: {e}")

    async def start(self):
        """Start the manager, including workers and supporting tasks."""
        try:
            if self.running:
                logger.info("[START] Manager already running")
                return
            self.running = True
            self.stop_event.clear()
            logger.info(f"[START] Starting {self._num_workers} worker(s)")
            self.enqueue_task = asyncio.create_task(self.enqueue_pending_jobs())
            logger.info("[START] Enqueue task created")
            if self.enable_status_check:
                self.status_task = asyncio.create_task(self.periodic_status_check())
                logger.info("[START] Status check task started")
            else:
                logger.info("[START] Status check disabled")
            for i in range(self._num_workers):
                task = asyncio.create_task(self.worker(i))
                self.worker_tasks.append(task)
                logger.info(f"[START] Worker {i} task created: {task}")
        except Exception as e:
            logger.error(f"[START] Failed to start manager: {e}")
            raise

    async def stop(self):
        try:
            if not self.running:
                logger.info("[STOP] Manager already stopped")
                return
            logger.info("[STOP] Stopping GlobalQueueManager")
            self.running = False
            self.stop_event.set()
            
            # Cancel and await the enqueue task
            if self.enqueue_task:
                logger.info("[STOP] Cancelling enqueue task")
                self.enqueue_task.cancel()
                try:
                    await self.enqueue_task
                except asyncio.CancelledError:
                    logger.info("[STOP] Enqueue task cancelled")
            
            # Cancel and await all worker tasks
            for task in self.worker_tasks:
                logger.info("[STOP] Cancelling worker task")
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info("[STOP] Worker task cancelled")
            
            # Clean up state
            self.worker_tasks.clear()
            self.enqueue_task = None
            self.status_task = None  # If you have a status task, handle it similarly
            logger.info("[STOP] Stopped successfully and state reset")
        except Exception as e:
            logger.error(f"[STOP] Failed to stop manager: {e}")

    async def periodic_status_check(self):
        """Periodically check status and stop the manager if idle."""
        while self.running:
            try:
                await asyncio.sleep(self.status_check_interval)
                with self._lock:
                    pending_count = len(self.pending_tasks)
                    queue_size = self.queue.qsize()
                    if pending_count == 0 and queue_size == 0:
                        logger.info("[STATUS] No pending tasks or queued jobs, stopping manager")
                        await self.stop()
                        break
                # Log status
                pending_jobs_count = self.pending_task_repo.count(filters={"status": "pending"})
                logger.info(f"[STATUS] Pending tasks: {pending_count}, Queue size: {queue_size}, DB pending: {pending_jobs_count}, function_cache: {len(self.function_cache)}")
            except Exception as e:
                logger.error(f"[STATUS] Error in status check: {e}")
            except asyncio.CancelledError:
                logger.info("[STATUS] Status check cancelled")
                break

    async def enqueue_pending_jobs(self):
        """Move jobs from the database to the main queue with retries."""
        while not self.stop_event.is_set():
            try:
                current_size = self.queue.qsize()
                available_space = self._max_queue_size - current_size
                pending_tasks = self.pending_task_repo.find(filters={"status": "pending"}, limit=available_space)
                if available_space > 0 and len(pending_tasks) > 0:
                    for task in pending_tasks:
                        job_id = task.task_id
                        logger.debug(f"[ENQUEUE] Processing task {job_id}")
                        cfut = None
                        for attempt in range(3):
                            with self._lock:
                                cfut = self.pending_tasks.get(job_id)
                            if cfut:
                                logger.debug(f"[ENQUEUE] Found future for task {job_id} on attempt {attempt + 1}")
                                break
                            logger.warning(f"[ENQUEUE] Future for task {job_id} not found, attempt {attempt + 1}/3")
                            await asyncio.sleep(0.1)
                        if cfut:
                            function_key = task.function_key
                            try:
                                args = json.loads(task.args_json)
                                kwargs = json.loads(task.kwargs_json)
                            except json.JSONDecodeError as e:
                                logger.error(f"[ENQUEUE] JSON decode error for task {job_id}: {e}")
                                continue
                            try:
                                await self.queue.put((job_id, function_key, args, kwargs, cfut))
                                self.pending_task_repo.update(
                                    filters={"task_id": job_id},
                                    updates={"status": "enqueued"}
                                )
                                logger.debug(f"[ENQUEUE] Task {job_id} enqueued")
                            except Exception as e:
                                logger.error(f"[ENQUEUE] Failed to enqueue task {job_id}: {e}")
                        else:
                            logger.error(f"[ENQUEUE] No future for task {job_id} after 3 retries, skipping")
                else:
                    logger.debug("[ENQUEUE] Queue full or no pending tasks, waiting")
                    await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"[ENQUEUE] Unexpected error: {e}")
            except asyncio.CancelledError:
                logger.info("[ENQUEUE] Enqueue task cancelled")
                # await self.stop()
                break

    async def worker(self, worker_id: int):
        """Process jobs from the queue with rate limiting."""
        logger.info(f"[WORKER {worker_id}] Started")
        try:
            while self.queue is None:
                logger.debug(f"[WORKER {worker_id}] Queue not initialized, waiting")
                await asyncio.sleep(0.1)
                
            while not self.stop_event.is_set():
                try:
                    job = await self.queue.get()
                    job_id, function_key, args, kwargs, cfut = job
                    logger.debug(f"[WORKER {worker_id}] Dequeued job {job_id}")

                    with self._lock:
                        if function_key not in self.function_cache:
                            logger.error(f"[WORKER {worker_id}] Function {function_key} not in cache for task {job_id}")
                            self.pending_task_repo.update(
                                filters={"task_id": job_id},
                                updates={"status": "failed", "error": f"Function {function_key} not found"}
                            )
                            cfut.set_exception(ValueError(f"Function {function_key} not found"))
                            self.queue.task_done()
                            continue
                        func = self.function_cache[function_key][0]

                    if self.rate_limit_per_sec:
                        async with self.rate_lock:
                            now = time.time()
                            min_interval = (1.0 / self.rate_limit_per_sec) + 0.1
                            elapsed = now - self.last_start_time
                            if elapsed < min_interval:
                                delay = min_interval - elapsed
                                logger.debug(f"[WORKER {worker_id}] Rate limit delay: {delay:.3f}s")
                                await asyncio.sleep(delay)
                            self.last_start_time = time.time()

                    try:
                        self.pending_task_repo.update(
                            filters={"task_id": job_id},
                            updates={"status": "in-progress", "started_at": datetime.now()}
                        )
                        result = await asyncio.wait_for(
                            asyncio.to_thread(func, *args, **kwargs),
                            timeout=120
                        )
                        cfut.set_result(result)
                        try:
                            result_json = json.dumps(result)
                        except TypeError:
                            result_json = json.dumps({"note": "Result was not serializable", "type": str(type(result))})
                        self.pending_task_repo.update(
                            filters={"task_id": job_id},
                            updates={"status": "completed", "result_json": result_json, "completed_at": datetime.now()}
                        )
                        logger.debug(f"[WORKER {worker_id}] Job {job_id} completed")
                    except asyncio.TimeoutError:
                        logger.error(f"[WORKER {worker_id}] Job {job_id} timed out after 600s")
                        cfut.set_exception(asyncio.TimeoutError("Task exceeded 600s"))
                        self.pending_task_repo.update(
                            filters={"task_id": job_id},
                            updates={"status": "failed", "error": "Timeout after 600s", "completed_at": datetime.now()}
                        )
                    except Exception as e:
                        logger.error(f"[WORKER {worker_id}] Job {job_id} failed: {e}")
                        cfut.set_exception(e)
                        self.pending_task_repo.update(
                            filters={"task_id": job_id},
                            updates={"status": "failed", "error": str(e), "completed_at": datetime.now()}
                        )
                    finally:
                        with self._lock:
                            if job_id in self.pending_tasks:
                                del self.pending_tasks[job_id]
                                logger.debug(f"[WORKER {worker_id}] Removed task {job_id} from pending_tasks")
                            if function_key in self.function_cache:
                                func, ref_count = self.function_cache[function_key]
                                ref_count -= 1
                                if ref_count == 0:
                                    del self.function_cache[function_key]
                                    logger.debug(f"[WORKER {worker_id}] Retired function {function_key}")
                                else:
                                    self.function_cache[function_key] = (func, ref_count)
                        self.queue.task_done()
                except asyncio.CancelledError:
                    logger.info(f"[WORKER {worker_id}] Cancelled")
                    # await self.stop()
                    break
                except Exception as e:
                    logger.error(f"[WORKER {worker_id}] Error in loop: {e}")
        except Exception as e:
            logger.error(f"[WORKER {worker_id}] Unexpected error: {e}")

    async def submit_task(self, func: Callable, function_key: str, *args, **kwargs) -> Tuple[str, asyncio.Future]:
        try:
            if not self.running:
                logger.info("[SUBMIT] Manager not running, starting it")
                future = asyncio.run_coroutine_threadsafe(self.start(), self.loop)
                await asyncio.wrap_future(future)
            job_id = str(uuid.uuid4())
            cfut = ConcurrentFuture()
            with self._lock:
                self.pending_tasks[job_id] = cfut
                logger.debug(f"[SUBMIT] Added task {job_id} to pending_tasks")
            logger.debug(f"[SUBMIT] Calling submit_task_sync for job_id {job_id}")
            self.submit_task_sync(job_id, func, function_key, *args, **kwargs)
            logger.debug(f"[SUBMIT] submit_task_sync completed for job_id {job_id}")
            asyncio_fut = asyncio.wrap_future(cfut, loop=asyncio.get_running_loop())
            return job_id, asyncio_fut
        except Exception as e:
            logger.error(f"[SUBMIT] Failed to submit task: {e}")
            raise

    def submit_task_sync(self, job_id: str, func: Callable, function_key: str, *args, **kwargs):
        """Synchronously insert a task into the repository."""
        try:
            with self._lock:
                if function_key in self.function_cache:
                    _, ref_count = self.function_cache[function_key]
                    self.function_cache[function_key] = (func, ref_count + 1)
                    logger.debug(f"[SUBMIT_SYNC] Incremented ref_count for {function_key} to {ref_count + 1}")
                else:
                    self.function_cache[function_key] = (func, 1)
                    logger.debug(f"[SUBMIT_SYNC] Cached {function_key}")
                task = LlmPendingTask(
                    task_id=job_id,
                    status="pending",
                    function_key=function_key,
                    args_json=json.dumps(args),
                    kwargs_json=json.dumps(kwargs),
                    created_at=datetime.now()
                )
                self.pending_task_repo.insert(task)
                logger.debug(f"[SUBMIT_SYNC] Inserted task {job_id}")
        except Exception as e:
            logger.error(f"[SUBMIT_SYNC] Failed to insert task {job_id}: {e}")
            raise e

@lru_cache
def get_llm_manager():
    """Return a cached instance of GlobalQueueManager."""
    try:
        return GlobalQueueManager(
            max_queue_size=20,
            num_workers=5,
            rate_limit_per_minute=10,
            status_check_interval=15.0,
            enable_status_check=True
        )
    except Exception as e:
        logger.error(f"[GET_LLM_MANAGER] Failed to create GlobalQueueManager: {e}")
        raise