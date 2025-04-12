import asyncio
import ctypes
import os
import subprocess
import sys
import json
import time
from functools import lru_cache
import aiohttp

from constants import TRANSMISSION_RPC_URL, PATHS, get_default_transmission_cmd  # PATHS is assumed to be a dict with key "settings"

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
        print("Rechecking transmission", self._transmission_cmd[0], os.path.exists(self._transmission_cmd[0]))
        self.transmission_present = os.path.exists(self._transmission_cmd[0])
        if self.transmission_present:
            print("Recheck: Transmission CLI is present at:", self._transmission_cmd[0])
        else:
            print("Recheck: Transmission CLI is not present at:", self._transmission_cmd[0])
        return self.transmission_present

    async def _kill_existing_daemons(self):
        """Kill any existing Transmission daemon processes, using elevated privileges on Windows only when necessary."""
        process_name = os.path.basename(self._transmission_cmd[0])  # e.g., "transmission-daemon.exe"
        pids = []

        # Step 1: Identify running Transmission daemon processes
        if sys.platform == "win32":
            try:
                proc = await asyncio.create_subprocess_exec(
                    "tasklist", "/FI", f"IMAGENAME eq {process_name}",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, _ = await proc.communicate()
                lines = stdout.decode().splitlines()
                for line in lines:
                    if process_name in line:
                        parts = line.split()
                        pid = parts[1]  # PID is the second column in tasklist output
                        pids.append(pid)
            except Exception as e:
                print(f"Error listing Transmission daemons: {e}")
                raise
        else:
            return
            # try:
            #     proc = await asyncio.create_subprocess_exec(
            #         "pgrep", "-f", process_name,
            #         stdout=asyncio.subprocess.PIPE,
            #         stderr=asyncio.subprocess.PIPE
            #     )
            #     stdout, _ = await proc.communicate()
            #     pids = stdout.decode().splitlines()
            # except Exception as e:
            #     print(f"Error listing Transmission daemons on Unix-like system: {e}")
            #     raise

        if not pids:
            print("No existing Transmission daemons found.")
            return

        # Step 2: Kill processes, using elevation only when needed
        if sys.platform == "win32":
            shell32 = ctypes.windll.shell32

            def parse_taskkill_output(output):
                """Parse the combined stdout and stderr output of taskkill to determine the result."""
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
                # Check if the process still exists
                check_proc = await asyncio.create_subprocess_exec(
                    "tasklist", "/FI", f"PID eq {pid}",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, _ = await check_proc.communicate()
                if pid not in stdout.decode():
                    print(f"Process PID {pid} not found, likely already terminated.")
                    continue

                # Try to kill without elevation first
                proc = await asyncio.create_subprocess_exec(
                    "taskkill", "/F", "/PID", pid,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await proc.communicate()
                output = stdout.decode() + stderr.decode()  # Combine stdout and stderr
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

                # Wait for the process to terminate
                start_time = time.time()
                while time.time() - start_time < 30:  # 30-second timeout
                    check_proc = await asyncio.create_subprocess_exec(
                        "tasklist", "/FI", f"PID eq {pid}",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await check_proc.communicate()
                    if pid not in stdout.decode():
                        print(f"Confirmed termination of PID {pid}.")
                        break
                    await asyncio.sleep(1)
                else:
                    error_msg = f"Process PID {pid} did not terminate within 30 seconds."
                    print(error_msg)
                    raise RuntimeError(error_msg)

            print(f"Processed {len(pids)} Transmission daemon(s).")
        # else:
            # for pid in pids:
            #     try:
            #         await asyncio.create_subprocess_exec("kill", pid)
            #     except Exception as e:
            #         print(f"Error killing PID {pid}: {e}")
            #         print(f"You may need to run 'sudo kill {pid}' if permissions are insufficient.")
            #     while True:
            #         proc = await asyncio.create_subprocess_exec(
            #             "ps", "-p", pid,
            #             stdout=asyncio.subprocess.PIPE,
            #             stderr=asyncio.subprocess.PIPE
            #         )
            #         stdout, _ = await proc.communicate()
            #         if not stdout:
            #             break
            #         await asyncio.sleep(0.1)

    async def __aenter__(self):
        await self._termination_lock.acquire()
        self._termination_lock.release()
        # if sys.platform == "win32":
        #     asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

        async with self._lock:
            if self._ref_count == 0:
                if not self.transmission_present:
                    raise RuntimeError("Transmission CLI is not available on this system.")
                await self._kill_existing_daemons()
                print("Starting Transmission daemon...", self._transmission_cmd)
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
                    self._stdout_task.cancel()
                    self._stderr_task.cancel()
                    self._process = None
                    print("Transmission daemon terminated.")
                finally:
                    self._termination_lock.release()

@lru_cache
def get_transmission_manager():
    return GlobalTransmissionDaemonManager()

