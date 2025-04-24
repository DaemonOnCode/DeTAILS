import sys
import os
import asyncio
import socket
import json
from typing import Callable, Awaitable

# on Windows use TCP, otherwise Unix domain socket
USE_TCP = sys.platform.startswith("win")
ADDR = ("127.0.0.1", 8765) if USE_TCP else "/tmp/details_ws_ipc.sock"

async def start_ipc_server(
    handle_line: Callable[[str], Awaitable[None]]
) -> tuple[asyncio.AbstractServer, asyncio.Task]:
    if not USE_TCP:
        print(f"IPC server using Unix domain socket at {ADDR}")
        try: os.unlink(ADDR)
        except FileNotFoundError: pass
        server = await asyncio.start_unix_server(
            lambda r, w: _tcp_client(r, w, handle_line),
            path=ADDR
        )
    else:
        print(f"IPC server using TCP socket at {ADDR}")
        server = await asyncio.start_server(
            lambda r, w: _tcp_client(r, w, handle_line),
            *ADDR
        )

    serve_task = asyncio.create_task(server.serve_forever())
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
    if USE_TCP:
        reader, writer = await asyncio.open_connection(*ADDR)
    else:
        reader, writer = await asyncio.open_unix_connection(path=ADDR)

    writer.write(data.encode())
    await writer.drain()
    writer.close()
    await writer.wait_closed()
