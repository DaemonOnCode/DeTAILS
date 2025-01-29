import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from database.initialize import initialize_database
from database.table_data_class import Comments, Datasets, LlmResponses, Models, Posts, Rules, TokenStats, TokenStatsDetailed, TokenizedComments, TokenizedPosts, WorkspaceStates, Workspaces
from routes import coding_routes, modeling_routes, filtering_routes, collection_routes, websocket_routes, miscellaneous_routes, workspace_routes, state_routes

print("Initializing database...")
initialize_database([
    Workspaces, 
    WorkspaceStates, 
    Rules,
    TokenStats,
    TokenStatsDetailed,
    Models,
    Datasets, 
    Posts, 
    Comments,
    TokenizedPosts,
    TokenizedComments,
    LlmResponses
])

print("Database initialized!")
print("Starting FastAPI server...")
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(collection_routes.router, prefix="/api/collections", tags=["collections"])
app.include_router(modeling_routes.router, prefix="/api/data-modeling", tags=["topic-modeling"])
app.include_router(filtering_routes.router, prefix="/api/data-filtering", tags=["data-filtering"])
app.include_router(websocket_routes.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(coding_routes.router, prefix="/api/coding", tags=["coding"])
app.include_router(miscellaneous_routes.router, prefix="/api/miscellaneous", tags=["miscellaneous"])
app.include_router(workspace_routes.router, prefix="/api/workspaces", tags=["workspace"])
app.include_router(state_routes.router, prefix="/api/state", tags=["state"])

@app.get("/")
def health_check():
    return {"status": "Data modeling server is up and running!"}


if __name__ == "__main__":
    is_pyinstaller = getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS')
    uvicorn.run(
        "main:app",
        port=8080,
        reload=not is_pyinstaller  # Enable reload only outside of PyInstaller
    )