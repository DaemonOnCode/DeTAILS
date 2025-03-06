import asyncio
from starlette.types import ASGIApp, Receive, Scope, Send

class AbortOnDisconnectMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        # Only apply to HTTP requests
        # if scope["type"] != "http":
        #     await self.app(scope, receive, send)
        #     return

        # Create an event that will be triggered if a disconnect occurs
        disconnect_event = asyncio.Event()

        async def wrapped_receive():
            message = await receive()
            if message["type"] == "http.disconnect":
                disconnect_event.set()
            return message

        # Run the main application and disconnect watcher concurrently
        app_task = asyncio.create_task(self.app(scope, wrapped_receive, send))
        disconnect_task = asyncio.create_task(disconnect_event.wait())

        done, pending = await asyncio.wait(
            {app_task, disconnect_task},
            return_when=asyncio.FIRST_COMPLETED,
        )

        # If the disconnect event happened before the app finished,
        # cancel the app task.
        if disconnect_task in done:
            app_task.cancel()
            # Optionally, you can perform cleanup here or log the disconnect.
        else:
            disconnect_task.cancel()
            await app_task
