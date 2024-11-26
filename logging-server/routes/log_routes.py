from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from models import Log
from schemas import LogCreate, LogResponse
from database import get_db

router = APIRouter()

@router.post("/log", response_model=LogResponse)
def create_log(log: LogCreate, db: Session = Depends(get_db)):
    """
    Save log messages to the database.
    """
    db_log = Log(
        email=log.email,
        level=log.level.upper(),
        message=log.message,
        cpu_usage=log.cpu_usage,
        ram_usage=log.ram_usage,
        context=log.context,
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.get("/logs", response_model=List[LogResponse])
def get_logs(
    email: Optional[str] = Query(None, description="Filter by user email"),
    level: Optional[str] = Query(None, description="Filter by log level"),
    start_time: Optional[datetime] = Query(None, description="Filter by start time (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="Filter by end time (ISO format)"),
    db: Session = Depends(get_db)
):
    """
    Retrieve logs from the database with optional filters.
    """
    query = db.query(Log)
    if email:
        query = query.filter(Log.email == email)
    if level:
        query = query.filter(Log.level == level.upper())
    if start_time:
        query = query.filter(Log.timestamp >= start_time)
    if end_time:
        query = query.filter(Log.timestamp <= end_time)
    
    logs = query.all()
    return logs
