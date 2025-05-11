import asyncio
import sys
import ctypes
import os
import subprocess
import json
import threading
import time
from functools import lru_cache
import aiohttp

from constants import TRANSMISSION_RPC_URL, PATHS, get_default_transmission_cmd  

async def wait_for_transmission(timeout=120.0, interval=0.5):
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            async with aiohttp.ClientSession(
                conn_timeout = timeout,
            ) as session:
                async with session.get(TRANSMISSION_RPC_URL) as response:
                    if response.status in (200, 409):
                        print("Transmission daemon is up and running.", response.status, await response.text())
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

def _drain_pipe(pipe):
    for raw in pipe:
        print(raw.decode().rstrip())

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
            if not custom_path.strip():
                transmission_config["path"] = default_path
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

async def run_blocking(cmd: list[str]) -> tuple[str, str, int]:
    loop = asyncio.get_running_loop()
    def _run():
        cp = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return cp.stdout, cp.stderr, cp.returncode
    return await loop.run_in_executor(None, _run)


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
        print("Rechecking transmission", self._transmission_cmd[0], os.path.exists(self._transmission_cmd[0]))
        self.transmission_present = os.path.exists(self._transmission_cmd[0])
        if self.transmission_present:
            print("Recheck: Transmission CLI is present at:", self._transmission_cmd[0])
        else:
            print("Recheck: Transmission CLI is not present at:", self._transmission_cmd[0])
        return self.transmission_present

    async def _kill_existing_daemons(self):
        process_name = os.path.basename(self._transmission_cmd[0])  
        pids = []

        if sys.platform == "win32":
            try:
                stdout, _err, _rc = await run_blocking(
                    ["tasklist", "/FI", f"IMAGENAME eq {process_name}"]
                )
                lines = stdout.splitlines()
                for line in lines:
                    if process_name in line:
                        parts = line.split()
                        pid = parts[1]  
                        pids.append(pid)
            except Exception as e:
                print(f"Error listing Transmission daemons: {e}")
                raise
        else:
            return

        if not pids:
            print("No existing Transmission daemons found.")
            return

        if sys.platform == "win32":
            shell32 = ctypes.windll.shell32

            def parse_taskkill_output(output):
                if "SUCCESS: The process with PID" in output:
                    return "success"
                elif "ERROR: The process \"" in output and "not found." in output:
                    return "not_found"
                elif "ERROR: The process with PID" in output and "could not be terminated." in output:
                    if "Reason: Access is denied." in output:
                        return "access_denied"
                    elif "Reason: There is no running instance of the task." in output:
                        return "no_instance"
                    elif "Reason: The process is not running." in output:
                        return "not_running"
                    else:
                        return "termination_error"
                else:
                    return "other_error"

            for pid in pids:
                out2, _e2, _ = await run_blocking(
                    ["tasklist", "/FI", f"PID eq {pid}"]
                )
                if pid not in out2:
                    print(f"Process PID {pid} not found, likely already terminated.")
                    continue

                stdout, stderr, _ = await run_blocking(
                    ["taskkill", "/F", "/PID", pid]
                )
                output = stdout + stderr
                result = parse_taskkill_output(output)

                if result == "success":
                    print(f"Successfully killed PID {pid} without elevation.")
                elif result == "not_found":
                    print(f"Process PID {pid} not found, likely already terminated.")
                elif result == "access_denied":
                    print(f"Access denied for PID {pid}, attempting with elevation.")
                    command = f'taskkill /F /PID {pid}'
                    result_code = shell32.ShellExecuteW(None, "runas", "cmd.exe", f'/c "{command}"', None, 1)
                    if result_code <= 32:
                        error_msg = f"Failed to kill PID {pid}: Administrator access not granted (ShellExecute returned {result_code})."
                        print(error_msg)
                        raise RuntimeError(error_msg)
                elif result in ("no_instance", "not_running"):
                    print(f"Process PID {pid} is not running or no instance found.")
                elif result == "termination_error":
                    error_msg = f"Error terminating PID {pid}: {output.strip()}"
                    print(error_msg)
                    raise RuntimeError(error_msg)
                else:
                    error_msg = f"Unknown error killing PID {pid}: {output.strip()}"
                    print(error_msg)
                    raise RuntimeError(error_msg)

                start_time = time.time()
                while time.time() - start_time < 30:  
                    confirm_out, _e, _ = await run_blocking(
                        ["tasklist", "/FI", f"PID eq {pid}"]
                    )
                    if pid not in confirm_out:
                        print(f"Confirmed termination of PID {pid}.")
                        break
                    await asyncio.sleep(1)
                else:
                    error_msg = f"Process PID {pid} did not terminate within 30 seconds."
                    print(error_msg)
                    raise RuntimeError(error_msg)

            print(f"Processed {len(pids)} Transmission daemon(s).")

    async def __aenter__(self):
        await self._termination_lock.acquire()
        self._termination_lock.release()
        async with self._lock:
            if self._ref_count == 0:
                if not self.transmission_present:
                    raise RuntimeError("Transmission CLI is not available on this system.")
                await self._kill_existing_daemons()
                print("Starting Transmission daemon...", self._transmission_cmd)
                if sys.platform == "win32":
                    loop = asyncio.get_running_loop()
                    def _spawn():
                        return subprocess.Popen(
                            self._transmission_cmd,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE
                        )
                    self._process = await loop.run_in_executor(None, _spawn)
                    threading.Thread(
                        target=_drain_pipe,
                        args=(self._process.stdout,),
                        daemon=True
                    ).start()
                    threading.Thread(
                        target=_drain_pipe,
                        args=(self._process.stderr,),
                        daemon=True
                    ).start()
                else:
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
                    if sys.platform == "win32":
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(self._process.pid)],
                            check=True
                        )
                    else:
                        self._process.terminate()
                        await self._process.wait()
                    if self._stdout_task:
                        self._stdout_task.cancel()
                    if self._stderr_task:
                        self._stderr_task.cancel()
                    self._process = None
                    print("Transmission daemon terminated.")
                finally:
                    self._termination_lock.release()

@lru_cache
def get_transmission_manager():
    return GlobalTransmissionDaemonManager()

