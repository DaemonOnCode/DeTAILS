import asyncio
from contextlib import asynccontextmanager
import json
import os
import sys
from fastapi import FastAPI
import uvicorn

from ipc import ADDR, USE_TCP, start_ipc_server
from routes.websocket_routes import router as ws_router, manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    server, serve_task = await start_ipc_server(
        lambda line: manager.send_message(**json.loads(line))
    )
    try:
        yield
    finally:
        serve_task.cancel()
        server.close()
        await server.wait_closed()
        try:
            await serve_task
        except asyncio.CancelledError:
            pass
        if not USE_TCP and os.path.exists(ADDR):
            os.unlink(ADDR)

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
