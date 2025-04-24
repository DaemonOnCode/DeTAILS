import sys
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from middlewares import (
    ErrorHandlingMiddleware,
    ExecutionTimeMiddleware,
    LoggingMiddleware,
    AbortOnDisconnectMiddleware,
)
from routes import (
    collection_routes,
    coding_routes,
    miscellaneous_routes,
    workspace_routes,
    state_routes,
    ollama_routes
)

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"]
)
app.add_middleware(AbortOnDisconnectMiddleware)
app.add_middleware(ExecutionTimeMiddleware)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(LoggingMiddleware)

app.include_router(collection_routes.router, prefix="/api/collections", tags=["collections"])
app.include_router(coding_routes.router, prefix="/api/coding", tags=["coding"])
app.include_router(miscellaneous_routes.router, prefix="/api/miscellaneous", tags=["miscellaneous"])
app.include_router(workspace_routes.router, prefix="/api/workspaces", tags=["workspace"])
app.include_router(state_routes.router, prefix="/api/state", tags=["state"])
app.include_router(ollama_routes.router, prefix="/api/ollama", tags=["ollama"])

@app.get("/")
def health_check():
    return {"status": "HTTP server is up!"}

if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception as e:
        print(f"Error reconfiguring stdout: {e}")
        pass

    is_pyinstaller = getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")
    uvicorn.run(
        "app_http:app",
        port=8080,
        reload=not is_pyinstaller and not sys.platform.startswith("win"),
        use_colors=not is_pyinstaller,
        workers=4
    )
