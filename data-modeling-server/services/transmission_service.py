import asyncio
import os
import sys
import json
import time
from functools import lru_cache
import aiohttp

from constants import TRANSMISSION_RPC_URL, PATHS, get_default_transmission_cmd  # PATHS is assumed to be a dict with key "settings"

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

def get_transmission_cmd():
    settings_path = PATHS.get("settings")
    default_cmd = get_default_transmission_cmd()
    default_path = default_cmd[0]
    print("Default transmission command:", default_cmd)
    if settings_path and os.path.exists(settings_path):
        try:
            with open(settings_path, "r") as f:
                data = json.load(f)
            transmission_config = data.get("transmission", {})
            custom_path = transmission_config.get("path", "")
            download_dir = transmission_config.get("downloadDir", "")
            # If the transmission path is empty, update with default path.
            if not custom_path.strip():
                transmission_config["path"] = default_path
                # If downloadDir is also empty, set default download directory.
                if not download_dir.strip():
                    default_download_dir = PATHS["transmission"]
                    transmission_config["downloadDir"] = default_download_dir
                data["transmission"] = transmission_config
                with open(settings_path, "w") as f:
                    json.dump(data, f, indent=4)
                print("Custom transmission path was empty; writing default path to settings:", default_path)
                return default_cmd
            else:
                if os.path.exists(custom_path):
                    # If the custom download directory is empty, update it.
                    if not download_dir.strip():
                        default_download_dir = PATHS["transmission"]
                        transmission_config["downloadDir"] = default_download_dir
                        data["transmission"] = transmission_config
                        with open(settings_path, "w") as f:
                            json.dump(data, f, indent=4)
                    return [custom_path, "--foreground"]
                else:
                    print("Custom transmission path provided but invalid; updating with default path.")
                    transmission_config["path"] = default_path
                    if not download_dir.strip():
                        default_download_dir = PATHS["transmission"]
                        transmission_config["downloadDir"] = default_download_dir
                    data["transmission"] = transmission_config
                    with open(settings_path, "w") as f:
                        json.dump(data, f, indent=4)
                    return default_cmd
        except Exception as e:
            print("Error reading custom transmission settings:", e)
    return default_cmd

class GlobalTransmissionDaemonManager:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._termination_lock = asyncio.Lock()
        self._ref_count = 0
        self._process = None
        self._stdout_task = None
        self._stderr_task = None

        self._transmission_cmd = get_transmission_cmd()

        self.transmission_present = os.path.exists(self._transmission_cmd[0])
        if self.transmission_present:
            print("Transmission CLI is present at:", self._transmission_cmd[0])
        else:
            print("Transmission CLI is not present at:", self._transmission_cmd[0])

    def recheck_transmission(self):
        self.transmission_present = os.path.exists(self._transmission_cmd[0])
        if self.transmission_present:
            print("Recheck: Transmission CLI is present at:", self._transmission_cmd[0])
        else:
            print("Recheck: Transmission CLI is not present at:", self._transmission_cmd[0])
        return self.transmission_present

    async def __aenter__(self):
        await self._termination_lock.acquire()
        self._termination_lock.release()

        async with self._lock:
            if self._ref_count == 0:
                if not self.transmission_present:
                    raise RuntimeError("Transmission CLI is not available on this system.")
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

