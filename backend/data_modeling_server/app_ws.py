import asyncio
from contextlib import asynccontextmanager
import json
import os
import sys
import logging
from fastapi import FastAPI
import uvicorn

from ipc import ADDR, USE_TCP, start_ipc_server
from routes.websocket_routes import router as ws_router, manager

async def handle_line(line: str):
    print(f"Received IPC message: {line}")
    try:
        data = json.loads(line)
        await manager.send_message(**data) 
        print("Message sent to WebSocket manager")
    except json.JSONDecodeError:
        print("Invalid JSON received")
    except Exception as e:
        print(f"Error processing message: {e}")

async def is_ipc_running() -> bool:
    try:
        if USE_TCP:
            reader, writer = await asyncio.open_connection(*ADDR)
        else:
            reader, writer = await asyncio.open_unix_connection(path=ADDR)
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    owned = False
    server = None
    serve_task = None

    if await is_ipc_running():
        print(f"Detected existing IPC server at {ADDR}, skipping bind")
    else:
        print("No IPC server detected; starting one now")
        server, serve_task = await start_ipc_server(handle_line)
        owned = True

        if not USE_TCP:
            if os.path.exists(ADDR):
                print(f"Confirmed socket file exists at {ADDR}")
            else:
                print(f"Socket file {ADDR} missing after bind")

    try:
        yield
    finally:
        if owned and serve_task:
            print("Shutting down IPC server")
            serve_task.cancel()
            server.close()
            await server.wait_closed()

            if not USE_TCP and os.path.exists(ADDR):
                try:
                    os.unlink(ADDR)
                    print(f"Cleaned up socket file at {ADDR}")
                except Exception as e:
                    print(f"Error cleaning up socket file: {e}")

app = FastAPI(lifespan=lifespan)

app.include_router(ws_router, prefix="/api/notifications", tags=["notifications"])

@app.get("/")
def health_check_ws():
    return {"status": "WebSocket server is up!"}

if __name__ == "__main__":
    is_pyinstaller = getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")
    uvicorn.run(
        "app_ws:app",
        port=8081,
        reload=False,
        use_colors=not is_pyinstaller,
    )