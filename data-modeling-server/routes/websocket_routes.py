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

        # Start the keep-alive task
        keep_alive_task = asyncio.create_task(self.send_keep_alive(websocket))

        try:
            while True:
                # Handle incoming messages (if needed)
                data = await websocket.receive_text()
                print(f"Received message: {data}")
        except Exception as e:
            print(f"Error in websocket connection: {e}")
        finally:
            # Clean up connection and cancel the keep-alive task
            self.disconnect(websocket)
            keep_alive_task.cancel()

    async def send_keep_alive(self, websocket: WebSocket):
        try:
            while True:
                await websocket.send_text("ping")
                await asyncio.sleep(30)  # Send "ping" every 30 seconds
        except Exception as e:
            print(f"Error in send_keep_alive: {e}")

    def disconnect(self, websocket: WebSocket):
        print("WebSocket connection closed")
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        print("Broadcasting message to all clients")
        print(f"Message: {message}")
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
                print(f"Message sent to {connection}")
            except Exception as e:
                print(f"Error sending message to {connection}: {e}")
                self.disconnect(connection)
        await asyncio.sleep(0)

manager = ConnectionManager()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive or process incoming data
    except Exception as e:
        print(f"Error in websocket connection: {e}")
        manager.disconnect(websocket)

@router.post("/notify")
async def notify_clients(data: dict):
    print("Notifying all clients, data:", data)
    await manager.broadcast(f"Data update: {data}")
    return {"status": "notified"}
