import errno
import sys
import os
import asyncio
import socket
import json
from typing import Callable, Awaitable

from errors.request_errors import RequestError

# on Windows use TCP, otherwise Unix domain socket
USE_TCP = sys.platform.startswith("win")
ADDR = ("localhost", 11223) if USE_TCP else "/tmp/details_ws_ipc.sock"

ipc_owner = False

async def start_ipc_server(
    handle_line: Callable[[str], Awaitable[None]]
) -> tuple[asyncio.AbstractServer|None, asyncio.Task|None]:
    global ipc_owner

    if USE_TCP:
        try:
            reader, writer = await asyncio.open_connection(*ADDR)
            writer.close()
            await writer.wait_closed()
            print("IPC TCP %s already in use; skipping bind", ADDR)
            return None, None
        except Exception:
            pass
    else:
        if os.path.exists(ADDR):
            try:
                reader, writer = await asyncio.open_unix_connection(ADDR)
                writer.close()
                await writer.wait_closed()
                print("IPC server %s already in use; skipping bind", ADDR)
                return None, None
            except Exception as e:
                print("Detected stale socket %s (%s), unlinking", ADDR, e)
                os.unlink(ADDR)

    if USE_TCP:
        server = await asyncio.start_server(
            lambda r, w: _tcp_client(r, w, handle_line),
            *ADDR,
            backlog=128,
        )
    else:
        server = await asyncio.start_unix_server(
            lambda r, w: _tcp_client(r, w, handle_line),
            path=ADDR,
            backlog=128,
        )
        os.chmod(ADDR, 0o755)

    serve_task = asyncio.create_task(server.serve_forever())
    ipc_owner = True
    print("IPC server bound at %s", ADDR)
    return server, serve_task

async def _tcp_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    handle_line: Callable[[str], Awaitable[None]]
):
    while not reader.at_eof():
        line = await reader.readline()
        if not line:
            break
        try:
            await handle_line(line.decode().rstrip("\n"))
        except Exception:
            pass
    writer.close()
    await writer.wait_closed()


async def send_ipc_message(app_id: str, message: str):
    data = json.dumps({"app_id": app_id, "message": message}) + "\n"
    for attempt in range(1, 4):
        try:
            if USE_TCP:
                reader, writer = await asyncio.open_connection(*ADDR)
            else:
                reader, writer = await asyncio.open_unix_connection(path=ADDR)
            break
        except FileNotFoundError:
            if attempt < 3:
                await asyncio.sleep(1)
            else:
                print(f"IPC server not running after {attempt} attempts, unable to send message: {message}")
                raise RequestError(
                    status_code=500,
                    message=f"IPC server not running, unable to send message: {message}"
                )
    try:
        writer.write(data.encode())
        await writer.drain()
    finally:
        writer.close()
        await writer.wait_closed()