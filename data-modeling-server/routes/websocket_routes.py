from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import asyncio

router = APIRouter()


import aiohttp

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # Keyed by app name
        self.keep_alive_tasks: Dict[str, asyncio.Task] = {}  # Keep-alive tasks per app

    async def add_connection(self, app_name: str, websocket: WebSocket):
        """Add a WebSocket connection and start a keep-alive task."""
        self.active_connections[app_name] = websocket
        print(f"Added connection for app: {app_name}")

        # Start a keep-alive task for the app
        self.keep_alive_tasks[app_name] = asyncio.create_task(self.keep_alive(app_name, websocket))

    def remove_connection(self, app_name: str):
        """Remove a WebSocket connection and cancel the keep-alive task."""
        if app_name in self.active_connections:
            del self.active_connections[app_name]
            print(f"Removed connection for app: {app_name}")

        # Cancel the keep-alive task if it exists
        if app_name in self.keep_alive_tasks:
            self.keep_alive_tasks[app_name].cancel()
            del self.keep_alive_tasks[app_name]

    async def send_message(self, app_name: str, message: str):
        """Send a message to a specific app."""
        if app_name in self.active_connections:
            websocket = self.active_connections[app_name]
            try:
                await websocket.send_text(message)
            except Exception as e:
                print(f"Failed to send message to {app_name}: {e}")
                self.remove_connection(app_name)

    async def broadcast(self, message: str):
        """Broadcast a message to all connected apps and send to Discord webhook."""
        webhook_url = ""
        for app_name, websocket in self.active_connections.items():
            try:
                # Send message to the WebSocket
                print(f"Sending message to {app_name}: {message}")
                await websocket.send_text(message)
            except Exception as e:
                print(f"Failed to send message to {app_name}: {e}")
                self.remove_connection(app_name)

        # Send message to Discord webhook asynchronously
        asyncio.create_task(self.send_to_discord(webhook_url, message))

    async def send_to_discord(self, webhook_url: str, message: str):
        """Send a message to the Discord webhook."""
        async with aiohttp.ClientSession() as session:
            try:
                payload = {"content": message}
                async with session.post(webhook_url, json=payload) as response:
                    if response.status == 204:
                        print("Message successfully sent to Discord webhook.")
                    else:
                        print(f"Failed to send message to Discord webhook. Status: {response.status}")
            except Exception as e:
                print(f"Error sending message to Discord webhook: {e}")

    async def keep_alive(self, app_name: str, websocket: WebSocket):
        """Send periodic pings to keep the connection alive."""
        try:
            while True:
                await asyncio.sleep(5)  # Send a ping every 30 seconds
                await websocket.send_text("ping")
        except Exception as e:
            print(f"Keep-alive failed for {app_name}: {e}")
            self.remove_connection(app_name)



manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, app: str = Query(...)):
    """Handle WebSocket connection for a specific app."""
    app_name = app
    await websocket.accept()
    await manager.add_connection(app_name, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received from {app_name}: {data}")

            # Reply to ping messages
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for app: {app_name}")
    except Exception as e:
        print(f"Error in WebSocket for app {app_name}: {e}")
    finally:
        manager.remove_connection(app_name)


@router.websocket("/notify")
async def notify_endpoint(websocket: WebSocket):
    """Send a message to all connected apps."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
            # break
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    # await websocket.send_text("Message sent to all connected apps.")