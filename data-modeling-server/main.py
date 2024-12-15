from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routes import modeling_routes, filtering_routes, collection_routes, websocket_routes, coding_routes, miscellaneous_routes

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(collection_routes.router, prefix="/api/collections", tags=["collections"])
app.include_router(modeling_routes.router, prefix="/api/topic-modeling", tags=["topic-modeling"])
app.include_router(filtering_routes.router, prefix="/api/data-filtering", tags=["data-filtering"])
app.include_router(websocket_routes.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(coding_routes.router, prefix="/api/coding", tags=["coding"])
app.include_router(miscellaneous_routes.router, prefix="/api/miscellaneous", tags=["miscellaneous"])

@app.get("/")
def health_check():
    return {"status": "Data modeling server is up and running!"}


if __name__ == "__main__":
    uvicorn.run("main:app", port=8080, reload=True)