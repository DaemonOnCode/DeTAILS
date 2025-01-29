import logging
import asyncio
import aiohttp
from typing import Optional, Dict

# Configuration
LOGGING = False  # Set to False to disable external logging
LOGGING_API_URL = ""  # Replace with actual URL

class Logger:
    def __init__(self):
        self.user_email = "Anonymous"
        self.session = None  # Defer initialization

    async def _init_session(self):
        """Lazily initialize aiohttp.ClientSession."""
        if self.session is None:
            self.session = aiohttp.ClientSession()

    def set_user_email(self, user: str):
        """Set the user email for logging."""
        self.user_email = user

    async def log(self, level: str, message: str, context: Optional[Dict] = None):
        """Asynchronously logs a message with a given level and optional context."""
        await self._init_session()  # Ensure session is initialized

        if context is None:
            context = {}

        log_entry = {
            "sender": "BACKEND SERVER",
            "email": self.user_email,
            "level": level,
            "message": message,
            "context": context,
            "timestamp": asyncio.get_event_loop().time()  # Precise timestamp
        }

        # Print to console
        print(f"[{level.upper()}]: {message}")

        # Send to external logging API if enabled
        if LOGGING:
            try:
                async with self.session.post(
                    LOGGING_API_URL,
                    json=log_entry,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status != 200:
                        print(f"Failed to send log: {response.status}")
            except Exception as e:
                print(f"Logging error: {e}")

    async def info(self, message: str, context: Optional[Dict] = None):
        await self.log("info", message, context)

    async def warning(self, message: str, context: Optional[Dict] = None):
        await self.log("warning", message, context)

    async def error(self, message: str, context: Optional[Dict] = None):
        await self.log("error", message, context)

    async def debug(self, message: str, context: Optional[Dict] = None):
        await self.log("debug", message, context)

    async def health(self, message: str, context: Optional[Dict] = None):
        await self.log("health", message, context)

    async def time(self, message: str, context: Optional[Dict] = None):
        await self.log("time", message, context)

    async def close(self):
        """Close the aiohttp session if it was created."""
        if self.session:
            await self.session.close()
            self.session = None  # Reset session