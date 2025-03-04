from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import asyncio
import json
import aiohttp

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # Keyed by app name (or app ID)
        self.keep_alive_tasks: Dict[str, asyncio.Task] = {}   # Keep-alive tasks per app

    async def add_connection(self, app_id: str, websocket: WebSocket):
        """Add a WebSocket connection and start a keep-alive task."""
        self.active_connections[app_id] = websocket
        print(f"Added connection for app: {app_id}")

        # Start a keep-alive task for the app
        self.keep_alive_tasks[app_id] = asyncio.create_task(self.keep_alive(app_id, websocket))

    def remove_connection(self, app_id: str):
        """Remove a WebSocket connection and cancel the keep-alive task."""
        if app_id in self.active_connections:
            del self.active_connections[app_id]
            print(f"Removed connection for app: {app_id}")

        # Cancel the keep-alive task if it exists
        if app_id in self.keep_alive_tasks:
            self.keep_alive_tasks[app_id].cancel()
            del self.keep_alive_tasks[app_id]

    async def send_message(self, app_id: str, message: str):
        """Send a message to a specific app."""
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
        """Broadcast a message to all connected apps and send to Discord webhook."""
        # webhook_url = ""  # Set your Discord webhook URL if needed.
        for app_id, websocket in list(self.active_connections.items()):
            try:
                print(f"Broadcasting message to {app_id}: {message}")
                await websocket.send_text(message)
            except Exception as e:
                print(f"Failed to send message to {app_id}: {e}")
                self.remove_connection(app_id)

        # Send message to Discord webhook asynchronously
        # asyncio.create_task(self.send_to_discord(webhook_url, message))

    # async def send_to_discord(self, webhook_url: str, message: str):
    #     """Send a message to the Discord webhook."""
    #     async with aiohttp.ClientSession() as session:
    #         try:
    #             payload = {"content": message}
    #             async with session.post(webhook_url, json=payload) as response:
    #                 if response.status == 204:
    #                     print("Message successfully sent to Discord webhook.")
    #                 else:
    #                     print(f"Failed to send message to Discord webhook. Status: {response.status}")
    #         except Exception as e:
    #             print(f"Error sending message to Discord webhook: {e}")

    async def keep_alive(self, app_id: str, websocket: WebSocket):
        """Send periodic pings to keep the connection alive."""
        try:
            while True:
                await asyncio.sleep(15)  # Sends a ping every 15 seconds
                await websocket.send_text("ping")
        except Exception as e:
            print(f"Keep-alive failed for {app_id}: {e}")
            self.remove_connection(app_id)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, app: str = Query(...)):
    """
    Handle WebSocket connection for a specific app.
    The client connects with a URL like:
      ws://<host>/ws?app=yourUniqueAppId
    """
    app_id = app  # You can treat this as the app ID
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
    """Accepts messages to be broadcast to all connected apps."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        print("Notify WebSocket disconnected")
