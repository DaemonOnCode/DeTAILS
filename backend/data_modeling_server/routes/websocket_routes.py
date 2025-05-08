from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import asyncio
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  
        self.keep_alive_tasks: Dict[str, asyncio.Task] = {}   

    async def add_connection(self, app_id: str, websocket: WebSocket):
        self.active_connections[app_id] = websocket
        print(f"Added connection for app: {app_id}")
        self.keep_alive_tasks[app_id] = asyncio.create_task(self.keep_alive(app_id, websocket))

    def remove_connection(self, app_id: str):
        if app_id in self.active_connections:
            del self.active_connections[app_id]
            print(f"Removed connection for app: {app_id}")

        if app_id in self.keep_alive_tasks:
            self.keep_alive_tasks[app_id].cancel()
            del self.keep_alive_tasks[app_id]

    async def send_message(self, app_id: str, message: str):
        # await asyncio.sleep(0)
        print(f"Sending message to {app_id}: {message}")
        if app_id in self.active_connections:
            websocket = self.active_connections[app_id]
            try:
                await websocket.send_text(message)
            except Exception as e:
                print(f"Failed to send message to {app_id}: {e}")
                self.remove_connection(app_id)
        else:
            print(f"No active connection for app {app_id}")

    async def broadcast(self, message: str):
        for app_id, websocket in list(self.active_connections.items()):
            try:
                print(f"Broadcasting message to {app_id}: {message}")
                await websocket.send_text(message)
            except Exception as e:
                print(f"Failed to send message to {app_id}: {e}")
                self.remove_connection(app_id)

    async def keep_alive(self, app_id: str, websocket: WebSocket):
        try:
            while True:
                await asyncio.sleep(15)
                try:
                    await websocket.send_text("ping")
                except Exception as e:
                    print(f"Keep-alive failed for {app_id}: {e}")
                    self.remove_connection(app_id)
                    break
        except asyncio.CancelledError:
            pass


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, app: str = Query(...)):
    app_id = app
    await websocket.accept()
    await manager.add_connection(app_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received from app {app_id}: {data}")
            try:
                msg_obj = json.loads(data)
                target_app = msg_obj.get("target_app")
                if target_app:
                    await manager.send_message(target_app, data)
                else:
                    print(f"No target_app specified in message from {app_id}: {data}")
            except json.JSONDecodeError:
                print(f"Received non-JSON message from {app_id}: {data}")
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for app: {app_id}")
    except Exception as e:
        print(f"Error in WebSocket for app {app_id}: {e}")
    finally:
        manager.remove_connection(app_id)

@router.websocket("/notify")
async def notify_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        print("Notify WebSocket disconnected")
