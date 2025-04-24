import asyncio
from collections import defaultdict
from datetime import datetime
from functools import lru_cache
import json
import sys
import threading
import time
import concurrent
from concurrent.futures import Future as ConcurrentFuture
from typing import Callable, Dict, List, Optional, Tuple, Type
import uuid

from config import CustomSettings
from constants import STUDY_DATABASE_PATH
from database import LlmPendingTaskRepository, LlmFunctionArgsRepository
from database.state_dump_table import StateDumpsRepository
from models import LlmPendingTask, LlmFunctionArgs
from models.table_dataclasses import StateDump

state_dump_repo = StateDumpsRepository(
    database_path = STUDY_DATABASE_PATH
)

class GlobalQueueManager:
    def __init__(
        self,
        max_queue_size: int = 10,
        num_workers: int = 3,
        auto_start: bool = True,
        rate_limit_per_minute: Optional[int] = None,
        status_check_interval: float = 5.0,
        enable_status_check: bool = True,
        cancel_threshold: int = 1,
        idle_threshold: float = 60.0,
        cutoff: float = 300,
    ):
        try:
            self._max_queue_size = max_queue_size
            self._num_workers = num_workers
            self.worker_tasks: List[asyncio.Task] = []
            self.worker_states: Dict[int, Tuple[str, float]] = {}
            self.running = False
            self.pending_tasks: Dict[str, ConcurrentFuture] = {}
            self._lock = threading.Lock()
            self.idle_threshold = idle_threshold
            settings = CustomSettings()
            self.cutoff = settings.ai.cutoff or cutoff

            self.function_cache: Dict[str, Tuple[Callable, int]] = {}
            self.cacheable_args: Dict[str, Dict[str, List|Dict]] = {}

            self.enable_status_check = enable_status_check
            self.status_task = None
            self.enqueue_task = None

            self.cancel_threshold = cancel_threshold
            self.function_jobs: Dict[str, List[str]] = defaultdict(list)
            self.cancelled_jobs_count: Dict[str, int] = defaultdict(int)

            self.rate_limit_per_minute = rate_limit_per_minute
            self.rate_limit_per_sec = rate_limit_per_minute / 60.0 if rate_limit_per_minute else None
            self.last_start_time = 0.0
            self.rate_lock = asyncio.Lock()
            self.status_check_interval = status_check_interval
            self.stop_event = asyncio.Event()

            self.loop = asyncio.new_event_loop()
            self.queue: Type[asyncio.Queue]  = None
            def init_queue():
                try:
                    self.queue = asyncio.Queue(maxsize=max_queue_size)
                    print("[INIT] Queue initialized in event loop")
                except Exception as e:
                    print(f"[INIT] Failed to initialize queue: {e}")
            self.loop.call_soon_threadsafe(init_queue)
            self.loop_thread = threading.Thread(target=self._run_loop, args=(self.loop,))
            self.loop_thread.start()
            time.sleep(0.1)

            try:
                self.pending_task_repo = LlmPendingTaskRepository()
                self.function_args_repo = LlmFunctionArgsRepository()
            except Exception as e:
                print(f"[INIT] Failed to initialize database classes: {e}")
                raise

            try:
                stray_tasks = self.pending_task_repo.find(filters={"status": ["pending", "enqueued", "in-progress"]})
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
                        print(f"[INIT] Marked stray task {task.task_id} as failed due to missing function {function_key}")
                    else:
                        print(f"[INIT] Task {task.task_id} with function {function_key} retained")
                print(f"[INIT] Processed {len(stray_tasks)} stray tasks")
            except Exception as e:
                print(f"[INIT] Error cleaning up stray tasks: {e}")

            if auto_start:
                try:
                    fut = asyncio.run_coroutine_threadsafe(self.start(), self.loop)
                    fut.result(timeout=5)
                    print("[INIT] Start method scheduled and completed")
                except Exception as e:
                    print(f"[INIT] Auto-start failed: {e}")

            print(f"[INIT] GlobalQueueManager initialized: max_queue_size={max_queue_size}, num_workers={num_workers}")
        except Exception as e:
            print(f"[INIT] Unexpected error during initialization: {e}")
            raise

    def _run_loop(self, loop: asyncio.AbstractEventLoop):
        try:
            asyncio.set_event_loop(loop)
            loop.run_forever()
        except Exception as e:
            print(f"[LOOP] Event loop failed: {e}")

    async def start(self):
        try:
            if self.running:
                print("[START] Manager already running")
                return
            self.running = True
            self.stop_event.clear()
            self.cutoff = CustomSettings().ai.cutoff or self.cutoff
            print(f"[START] Starting {self._num_workers} worker(s)")
            self.enqueue_task = asyncio.create_task(self.enqueue_pending_jobs())
            print("[START] Enqueue task created")
            if self.enable_status_check:
                self.status_task = asyncio.create_task(self.periodic_status_check())
                print("[START] Status check task started")
            else:
                print("[START] Status check disabled")
            for i in range(self._num_workers):
                task = asyncio.create_task(self.worker(i))
                self.worker_tasks.append(task)
                print(f"[START] Worker {i} task created: {task}")
        except Exception as e:
            print(f"[START] Failed to start manager: {e}")
            raise

    async def stop(self):
        try:
            if not self.running:
                print("[STOP] Manager already stopped")
                return
            print("[STOP] Stopping GlobalQueueManager")
            self.running = False
            self.stop_event.set()

            if self.enqueue_task:
                print("[STOP] Cancelling enqueue task")
                self.enqueue_task.cancel()
                try:
                    await self.enqueue_task
                except asyncio.CancelledError:
                    print("[STOP] Enqueue task cancelled")

            for task in self.worker_tasks:
                print("[STOP] Cancelling worker task")
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    print("[STOP] Worker task cancelled")

            self.worker_tasks.clear()
            self.enqueue_task = None
            self.status_task = None 
            self.cacheable_args.clear()
            print("[STOP] Stopped successfully and state reset")
        except Exception as e:
            print(f"[STOP] Failed to stop manager: {e}")

    async def periodic_status_check(self):
        while self.running:
            try:
                await asyncio.sleep(self.status_check_interval)
                current_time = time.time()
                with self._lock:
                    pending_count = len(self.pending_tasks)
                    queue_size = self.queue.qsize()
                    pending_jobs_count = self.pending_task_repo.count(filters={"status": "pending"})

                    all_idle = all(state == "idle" for state, _ in self.worker_states.values())
                    if all_idle and self.worker_states:
                        max_last_updated = max(last_updated for _, last_updated in self.worker_states.values())
                        time_since_last_activity = current_time - max_last_updated
                        if (time_since_last_activity > self.idle_threshold and pending_jobs_count == 0 and queue_size == 0):
                            print(f"[STATUS] All workers idle for {time_since_last_activity:.2f}s, "
                                  f"no pending or queued jobs, stopping manager")
                            await self.stop()
                            break

                    if pending_count == 0 and queue_size == 0:
                        print("[STATUS] No pending tasks or queued jobs, stopping manager")
                        await self.stop()
                        break
                pending_jobs_count = self.pending_task_repo.count(filters={"status": "pending"})
                print(f"[STATUS] Pending tasks: {pending_count}, Queue size: {queue_size}, DB pending: {pending_jobs_count}, function_cache: {len(self.function_cache)}, Current cutoff: {self.cutoff}")
                # for k in self.function_cache.keys():
                #     print(f"[STATUS] Function {k} cached", self.cacheable_args.get(k, {"args": [], "kwargs": {}}))
                    # if self.cacheable_args[k].get("args"):
                    #     print(f"[STATUS] Cacheable args: {len(self.cacheable_args['args'])} for function {k}")
                    # if self.cacheable_args[k].get("kwargs"):
                    #     print(f"[STATUS] Cacheable kwargs: {len(self.cacheable_args['kwargs'])} for function {k}")
            except Exception as e:
                print(f"[STATUS] Error in status check: {e}")
            except asyncio.CancelledError:
                print("[STATUS] Status check cancelled")
                break

    async def enqueue_pending_jobs(self):
        while not self.stop_event.is_set():
            try:
                current_size = self.queue.qsize()
                available_space = self._max_queue_size - current_size
                if available_space == 0:
                    print("[ENQUEUE] Queue full, waiting")
                    await asyncio.sleep(0.5)
                    continue
                pending_tasks = self.pending_task_repo.find(filters={"status": "pending"}, limit=available_space)

                if available_space > 0 and len(pending_tasks) > 0:
                    for task in pending_tasks:
                        job_id = task.task_id
                        print(f"[ENQUEUE] Processing task {job_id}")
                        cfut = None
                        with self._lock:
                            cfut = self.pending_tasks.get(job_id)
                        if cfut:
                            function_key = task.function_key
                            try:
                                # Retrieve variable args and kwargs from the database
                                variable_args = json.loads(task.args_json)
                                variable_kwargs = json.loads(task.kwargs_json)

                                # Retrieve cached args and kwargs
                                cached_args = self.cacheable_args.get(function_key, {"args": [], "kwargs": {}})["args"]
                                cached_kwargs = self.cacheable_args.get(function_key, {"args": [], "kwargs": {}})["kwargs"]

                                # Reconstruct full args: combine cached and variable args
                                full_args = []
                                var_idx = 0
                                for i in range(max(len(cached_args), len(variable_args))):
                                    if i < len(cached_args) and cached_args[i] is not None:
                                        full_args.append(cached_args[i])
                                    elif var_idx < len(variable_args):
                                        full_args.append(variable_args[var_idx])
                                        var_idx += 1

                                full_kwargs = {**cached_kwargs, **variable_kwargs}

                                if "prompt_builder_func" in cached_kwargs:
                                    print(f"[ENQUEUE] Found prompt_builder_func for task {job_id}")
                                    prompt_builder_func = cached_kwargs["prompt_builder_func"]
                                    print(f"[ENQUEUE] Prompt builder function: {prompt_builder_func.__name__}")
                                    if not callable(prompt_builder_func):
                                        raise ValueError("prompt_builder_func must be a callable function")
                                    full_kwargs.pop("prompt_builder_func", None)
                                    prompt_text = prompt_builder_func(*full_args, **full_kwargs)
                                    full_args = [prompt_text]
                                    full_kwargs = {}

                                args_tuple = tuple(full_args)
                            except json.JSONDecodeError as e:
                                print(f"[ENQUEUE] JSON decode error for task {job_id}: {e}")
                                continue
                            try:
                                await self.queue.put((job_id, function_key, args_tuple, full_kwargs, cfut))
                                self.pending_task_repo.update(
                                    filters={"task_id": job_id},
                                    updates={"status": "enqueued"}
                                )
                                print(f"[ENQUEUE] Task {job_id} enqueued")
                            except Exception as e:
                                print(f"[ENQUEUE] Failed to enqueue task {job_id}: {e}")
                        else:
                            print(f"[ENQUEUE] No future for task {job_id}, marking failed")
                            dummy_fut = ConcurrentFuture()
                            dummy_fut.set_exception(
                                RuntimeError(f"No local future to process task {job_id}")
                            )
                            with self._lock:
                                for task in pending_tasks:
                                    job_id = task.task_id
                                    if job_id in self.pending_tasks:
                                        del self.pending_tasks[job_id]
                                        print(f"[ENQUEUE] Removed task {job_id} from pending_tasks")
                                    self.pending_task_repo.update(
                                        filters={"task_id": job_id},
                                        updates={"status": "failed", "error": "Task not found in pending_tasks"}
                                    )
                else:
                    print("[ENQUEUE] Queue not empty or no pending tasks, waiting")
                    await asyncio.sleep(1)
            except Exception as e:
                print(f"[ENQUEUE] Unexpected error: {e}")
            except asyncio.CancelledError:
                print("[ENQUEUE] Enqueue task cancelled")
                break

    async def worker(self, worker_id: int):
        print(f"[WORKER {worker_id}] Started")
        try:
            while self.queue is None:
                print(f"[WORKER {worker_id}] Queue not initialized, waiting")
                await asyncio.sleep(0.1)
                
            with self._lock:
                self.worker_states[worker_id] = ("idle", time.time())
            while not self.stop_event.is_set():
                try:
                    job = await self.queue.get()
                    job_id, function_key, args, kwargs, cfut = job
                    with self._lock:
                        self.worker_states[worker_id] = ("busy", time.time())
                    print(f"[WORKER {worker_id}] Dequeued job {job_id}")

                    with self._lock:
                        if function_key not in self.function_cache:
                            print(f"[WORKER {worker_id}] Function {function_key} not in cache for task {job_id}")
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
                                print(f"[WORKER {worker_id}] Rate limit delay: {delay:.3f}s")
                                await asyncio.sleep(delay)
                            self.last_start_time = time.time()

                    try:
                        self.pending_task_repo.update(
                            filters={"task_id": job_id},
                            updates={"status": "in-progress", "started_at": datetime.now()}
                        )
                        print(f"[WORKER {worker_id}] Executing job {job_id}", args, kwargs, func.__name__)
                        result = await asyncio.wait_for(
                            asyncio.to_thread(func, *args, **kwargs),
                            timeout=self.cutoff
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
                        print(f"[WORKER {worker_id}] Job {job_id} completed")
                    except asyncio.TimeoutError:
                        print(f"[WORKER {worker_id}] Job {job_id} timed out after {self.cutoff} seconds")
                        cfut.set_exception(asyncio.TimeoutError(f"Task exceeded {self.cutoff}s"))
                        self.pending_task_repo.update(
                            filters={"task_id": job_id},
                            updates={"status": "failed", "error": f"Timeout after {self.cutoff}s", "completed_at": datetime.now()}
                        )
                    except Exception as e:
                        if isinstance(e, concurrent.futures.CancelledError):
                            print(f"[WORKER {worker_id}] Job {job_id} was cancelled")
                            self.pending_task_repo.update(
                                filters={"task_id": job_id},
                                updates={"status": "cancelled", "completed_at": datetime.now()}
                            )
                            with self._lock:
                                self.cancelled_jobs_count[function_key] += 1
                                if self.cancelled_jobs_count[function_key] >= self.cancel_threshold:
                                    print(f"[WORKER {worker_id}] Cancelling all jobs for function {function_key}")
                                    for jid in self.function_jobs.get(function_key, []):
                                        if jid in self.pending_tasks and jid != job_id:  # Skip the current job
                                            self.pending_tasks[jid].cancel()
                                            self.pending_task_repo.update(
                                                filters={"task_id": jid},
                                                updates={"status": "cancelled", "completed_at": datetime.now()}
                                            )
                                            print(f"[WORKER {worker_id}] Cancelled job {jid}")
                                    self.cancelled_jobs_count[function_key] = 0  # Reset counter
                        else:
                            print(f"[WORKER {worker_id}] Job {job_id} failed: {e}")
                            cfut.set_exception(e)
                            self.pending_task_repo.update(
                                filters={"task_id": job_id},
                                updates={"status": "failed", "error": str(e), "completed_at": datetime.now()}
                            )
                    finally:
                        with self._lock:
                            self.worker_states[worker_id] = ("idle", time.time())
                            if job_id in self.pending_tasks:
                                del self.pending_tasks[job_id]
                                print(f"[WORKER {worker_id}] Removed task {job_id} from pending_tasks")
                            if function_key in self.function_jobs:
                                if job_id in self.function_jobs[function_key]:
                                    self.function_jobs[function_key].remove(job_id)
                                    if not self.function_jobs[function_key]:
                                        del self.function_jobs[function_key]
                                    print(f"[WORKER {worker_id}] Removed job {job_id} from function_jobs")
                            if function_key in self.function_cache:
                                func, ref_count = self.function_cache[function_key]
                                ref_count -= 1
                                if ref_count == 0:
                                    del self.function_cache[function_key]
                                    print(f"[WORKER {worker_id}] Retired function {function_key}")
                                else:
                                    self.function_cache[function_key] = (func, ref_count)
                        self.queue.task_done()
                except asyncio.CancelledError:
                    print(f"[WORKER {worker_id}] Cancelled")
                    break
                except Exception as e:
                    print(f"[WORKER {worker_id}] Error in loop: {e}")
        except Exception as e:
            print(f"[WORKER {worker_id}] Unexpected error: {e}")

    async def submit_task(self, func: Callable, function_key: str, *args, cacheable_args: Optional[Dict[str, List]] = None, **kwargs) -> Tuple[str, asyncio.Future]:
        try:
            if not self.running:
                print("[SUBMIT] Manager not running, starting it")
                future = asyncio.run_coroutine_threadsafe(self.start(), self.loop)
                await asyncio.wrap_future(future)
            job_id = str(uuid.uuid4())
            cfut = ConcurrentFuture()
            with self._lock:
                self.pending_tasks[job_id] = cfut
                print(f"[SUBMIT] Added task {job_id} to pending_tasks")
            print(f"[SUBMIT] Calling submit_task_sync for job_id {job_id}")
            self.submit_task_sync(job_id, func, function_key, cacheable_args, *args, **kwargs)
            print(f"[SUBMIT] submit_task_sync completed for job_id {job_id}")
            asyncio_fut = asyncio.wrap_future(cfut, loop=asyncio.get_running_loop())
            return job_id, asyncio_fut
        except Exception as e:
            print(f"[SUBMIT] Failed to submit task: {e}")
            raise

    def submit_task_sync(self, job_id: str, func: Callable, function_key: str, cacheable_args: Optional[Dict[str, List]] = None, *args, **kwargs):
        try:
            with self._lock:
                if function_key in self.function_cache:
                    _, ref_count = self.function_cache[function_key]
                    self.function_cache[function_key] = (func, ref_count + 1)
                    
                    print(f"[SUBMIT_SYNC] Incremented ref_count for {function_key} to {ref_count + 1}")
                else:
                    self.function_cache[function_key] = (func, 1)
                    print(f"[SUBMIT_SYNC] Cached {function_key}")

                    if cacheable_args is not None:
                        filtered_args = [arg if not callable(arg) else None for arg in cacheable_args.get("args", [])]
                        filtered_kwargs = {k: v for k, v in cacheable_args.get("kwargs", {}) if not callable(v)}
                        filtered_cacheables = {"args": filtered_args, "kwargs": filtered_kwargs}
                        
                        state_dump_repo.insert(
                            StateDump(
                                state=json.dumps({
                                    "cacheables": filtered_cacheables,
                                }),
                                context=json.dumps({
                                    "function": "submit_task_sync",
                                    "job_id": job_id,
                                    "function_key": function_key
                                }),
                            )
                        )


                if cacheable_args is None:
                    cacheable_args = {"args": [], "kwargs": []}

                if function_key not in self.cacheable_args:
                    self.cacheable_args[function_key] = {"args": [], "kwargs": {}}

                for i in cacheable_args.get("args", []):
                    if i < len(args):
                        if len(self.cacheable_args[function_key]["args"]) <= i:
                            self.cacheable_args[function_key]["args"].extend([None] * (i + 1 - len(self.cacheable_args[function_key]["args"])))
                        self.cacheable_args[function_key]["args"][i] = args[i]
                        print(f"[SUBMIT_SYNC] Cached arg at index {i} for {function_key}")

                for k in cacheable_args.get("kwargs", []):
                    if k in kwargs:
                        self.cacheable_args[function_key]["kwargs"][k] = kwargs[k]
                        print(f"[SUBMIT_SYNC] Cached kwarg {k} for {function_key}")

                
                variable_args = [args[i] for i in range(len(args)) if i not in cacheable_args.get("args", [])]
                variable_kwargs = {k: v for k, v in kwargs.items() if k not in cacheable_args.get("kwargs", [])}

                self.function_jobs[function_key].append(job_id)  # Track the job
                task = LlmPendingTask(
                    task_id=job_id,
                    status="pending",
                    function_key=function_key,
                    args_json=json.dumps(variable_args),
                    kwargs_json=json.dumps(variable_kwargs),
                    created_at=datetime.now()
                )
                self.pending_task_repo.insert(task)
                print(f"[SUBMIT_SYNC] Inserted task {job_id} and added to function_jobs")
        except Exception as e:
            print(f"[SUBMIT_SYNC] Failed to insert task {job_id}: {e}")
            raise e


@lru_cache
def get_llm_manager():
    try:
        
        return GlobalQueueManager(
            max_queue_size=20,
            num_workers=5,
            rate_limit_per_minute=20,
            status_check_interval=15.0,
            enable_status_check=True,
            cancel_threshold=1,
            idle_threshold=15,
            cutoff=300,
        )
    except Exception as e:
        print(f"Failed to create GlobalQueueManager: {e}")
        raise