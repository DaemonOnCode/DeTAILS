from fastapi import FastAPI
import uvicorn
from routes import modeling_routes

app = FastAPI()

app.include_router(modeling_routes.router, prefix="/api/topic-modeling", tags=["topic-modeling"])

@app.get("/")
def health_check():
    return {"status": "Data modeling server is up and running!"}


if __name__ == "__main__":
    uvicorn.run("main:app", port=9000, reload=True)