from sqlalchemy import Column, Integer, String, Float, Text, JSON, DateTime
from database import Base
from datetime import datetime

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    level = Column(String, index=True)
    message = Column(Text)
    context = Column(JSON, nullable=True)
    timestamp = Column(DateTime)
    current_timestamp = Column(DateTime, default=datetime.now())
    sender = Column(String)
