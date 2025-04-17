from fastapi import FastAPI
from database import engine
from fastapi.middleware.cors import CORSMiddleware
from models import Base
from routes import log_routes
import uvicorn

# Create the database tables
Base.metadata.create_all(bind=engine)

# Initialize the FastAPI app
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(log_routes.router, prefix="/api", tags=["logs"])

@app.get("/")
def health_check():
    return {"status": "Logging server is up and running!"}

# Run the FastAPI app
if __name__ == "__main__":
    uvicorn.run("main:app", port=9000, reload=True)