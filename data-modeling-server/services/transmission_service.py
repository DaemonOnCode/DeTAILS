import asyncio
from functools import lru_cache
import aiohttp
import time

from constants import TRANSMISSION_RPC_URL

async def wait_for_transmission(timeout=15, interval=0.5):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(TRANSMISSION_RPC_URL) as response:
                    if response.status in (200, 409):
                        print("Transmission daemon is up and running.")
                        return True
        except Exception:
            await asyncio.sleep(interval)
    return False

async def read_stream(stream: aiohttp.StreamReader | None):
    while True:
        line = await stream.readline()
        if not line:
            break
        print(line.decode().strip())

class GlobalTransmissionDaemonManager:
    def __init__(self):
        self._lock = asyncio.Lock()  
        self._termination_lock = asyncio.Lock() 
        self._ref_count = 0
        self._process = None
        self._stdout_task = None
        self._stderr_task = None
        self._transmission_cmd = [
            "/opt/homebrew/opt/transmission-cli/bin/transmission-daemon",
            "--foreground",
            "--config-dir", "/opt/homebrew/var/transmission/"
        ]

    async def __aenter__(self):
        await self._termination_lock.acquire()
        self._termination_lock.release()

        async with self._lock:
            if self._ref_count == 0:
                self._process = await asyncio.create_subprocess_exec(
                    *self._transmission_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                self._stdout_task = asyncio.create_task(read_stream(self._process.stdout))
                self._stderr_task = asyncio.create_task(read_stream(self._process.stderr))
                if not await wait_for_transmission():
                    raise RuntimeError("Transmission daemon did not start properly within the timeout period.")
                print("Transmission daemon started.")
            self._ref_count += 1
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        async with self._lock:
            self._ref_count -= 1
            if self._ref_count == 0:
                await self._termination_lock.acquire()
                try:
                    self._process.terminate()
                    await self._process.wait()
                    self._stdout_task.cancel()
                    self._stderr_task.cancel()
                    self._process = None
                    print("Transmission daemon terminated.")
                finally:
                    self._termination_lock.release()
                    
@lru_cache
def get_transmission_manager():
    return GlobalTransmissionDaemonManager()