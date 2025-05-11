import os
import sys
os.environ.setdefault('PYTHONUTF8', '1')
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

for stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8')
    except Exception:
        pass

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
    miscellaneous_routes,
    workspace_routes,
    ollama_routes
)
from routes.coding import (
    extra_routes, 
    analysis_routes, 
    codebook_routes, 
    theme_routes, 
    concept_routes,
    final_coding_routes,
    grouping_code_routes,
    paginated_routes,
    initial_coding_routes
)
from routes.states import (
    main_routes as state_routes,
    frontend_state_routes
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

app.include_router(initial_coding_routes.router, prefix="/api/coding", tags=["initial-coding"])
app.include_router(paginated_routes.router, prefix="/api/coding", tags=["paginated"])
app.include_router(analysis_routes.router, prefix="/api/coding", tags=["analysis"])
app.include_router(codebook_routes.router, prefix="/api/coding", tags=["codebook"])
app.include_router(theme_routes.router, prefix="/api/coding", tags=["theme"])
app.include_router(concept_routes.router, prefix="/api/coding", tags=["concept"])
app.include_router(final_coding_routes.router, prefix="/api/coding", tags=["final-coding"])
app.include_router(grouping_code_routes.router, prefix="/api/coding", tags=["grouping-codes"])
app.include_router(extra_routes.router, prefix="/api/coding", tags=["extra"])

app.include_router(miscellaneous_routes.router, prefix="/api/miscellaneous", tags=["miscellaneous"])

app.include_router(workspace_routes.router, prefix="/api/workspaces", tags=["workspace"])

app.include_router(state_routes.router, prefix="/api/state", tags=["state"])
app.include_router(frontend_state_routes.router, prefix="/api/state", tags=["frontend-state"])

app.include_router(ollama_routes.router, prefix="/api/ollama", tags=["ollama"])

@app.get("/")
def health_check():
    return {"status": "HTTP server is up!"}

if __name__ == "__main__":
    is_pyinstaller = getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")
    uvicorn.run(
        "app_http:app",
        port=8080,
        reload=not is_pyinstaller and not sys.platform.startswith("win"),
        use_colors=not is_pyinstaller,
        workers=4
    )
