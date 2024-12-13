from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        print("WebSocket connection initiated")
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        print("WebSocket connection closed")
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        print("Broadcasting message to all clients")
        print(f"Message: {message}")
        for connection in self.active_connections:
            await connection.send_text(message)
            print(f"Message sent to {connection}")

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print("WebSocket connection initiated")
    origin = websocket.headers.get("origin")
    print(f"WebSocket Origin: {origin}")
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive or process incoming data
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.post("/notify")
async def notify_clients(data: dict):
    print("Notifying all clients, data:", data)
    await manager.broadcast(f"Data update: {data}")
    return {"status": "notified"}
