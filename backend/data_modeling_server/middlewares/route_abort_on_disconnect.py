import asyncio
import json
from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

from constants import STUDY_DATABASE_PATH
from database.error_table import ErrorLogRepository
from models.table_dataclasses import ErrorLog

error_log_repository = ErrorLogRepository(database_path = STUDY_DATABASE_PATH)


class AbortOnDisconnectMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        queue = asyncio.Queue()

        async def message_poller(sentinel, handler_task):
            nonlocal queue
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    handler_task.cancel()
                    return sentinel 
                await queue.put(message)

        sentinel = object()
        handler_task = asyncio.create_task(self.app(scope, queue.get, send))
        asyncio.create_task(message_poller(sentinel, handler_task))

        try:
            return await handler_task
        except asyncio.CancelledError:
            print("Cancelling request due to disconnect")
            error_log_repository.insert(
                    ErrorLog(
                        type = "AbortRequest",
                        message = "Request aborted due to client disconnect",
                        context = json.dumps({
                            "route": scope["path"]
                        }),
                        traceback=""
                    )
                )
            await send({
                "type": "http.response.start",
                "status": 499,
                "headers": [],
            })
            await send({
                "type": "http.response.body",
                "body": b"",
                "more_body": False,
            })
