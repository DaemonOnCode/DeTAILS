import os
import sys
import time
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from constants import DATASETS_DIR, TRANSMISSION_DOWNLOAD_DIR
from database import initialize_database, WorkspacesRepository, WorkspaceStatesRepository, DatasetsRepository, PostsRepository, CommentsRepository, LlmResponsesRepository, FileStatusRepository, PipelineStepsRepository, TorrentDownloadProgressRepository
from middlewares import ErrorHandlingMiddleware, ExecutionTimeMiddleware, LoggingMiddleware
from routes import coding_routes, collection_routes, websocket_routes, miscellaneous_routes, workspace_routes, state_routes

load_dotenv()
print(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))

print("Starting FastAPI server...")
app = FastAPI()

print("Adding middleware...")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ExecutionTimeMiddleware)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(LoggingMiddleware)
print("Middleware added!")

app.include_router(collection_routes.router, prefix="/api/collections", tags=["collections"])
# app.include_router(modeling_routes.router, prefix="/api/data-modeling", tags=["topic-modeling"])
# app.include_router(filtering_routes.router, prefix="/api/data-filtering", tags=["data-filtering"])
app.include_router(websocket_routes.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(coding_routes.router, prefix="/api/coding", tags=["coding"])
app.include_router(miscellaneous_routes.router, prefix="/api/miscellaneous", tags=["miscellaneous"])
app.include_router(workspace_routes.router, prefix="/api/workspaces", tags=["workspace"])
app.include_router(state_routes.router, prefix="/api/state", tags=["state"])

@app.get("/")
def health_check():
    return {"status": "Data modeling server is up and running!"}


if __name__ == "__main__":
    print("Initializing database...")
    initialize_database([
        WorkspacesRepository, 
        WorkspaceStatesRepository, 
        # RulesRepository,
        # TokenStatsRepository,
        # TokenStatsDetailedRepository,
        # ModelsRepository,
        DatasetsRepository, 
        PostsRepository, 
        CommentsRepository,
        # TokenizedPostsRepository,
        # TokenizedCommentsRepository,
        LlmResponsesRepository,

        TorrentDownloadProgressRepository,
        FileStatusRepository,
        PipelineStepsRepository
    ])

    print("Database initialized!")

    os.mkdir(DATASETS_DIR) if not os.path.exists(DATASETS_DIR) else None
    # os.mkdir(TRANSMISSION_DOWNLOAD_DIR) if not os.path.exists(TRANSMISSION_DOWNLOAD_DIR) else None
    print("Directories created!")
    
    is_pyinstaller = getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS')
    uvicorn.run(
        "main:app",
        port=8080,
        reload=not is_pyinstaller  # Enable reload only outside of PyInstaller
    )