from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.db import Base

class ScanTask(Base):
    __tablename__ = "scan_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    query_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    entities = relationship("ScanEntity", back_populates="task", cascade="all, delete-orphan")

class ScanEntity(Base):
    __tablename__ = "scan_entities"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("scan_tasks.id"))
    name = Column(String, nullable=False)
    entity_type = Column(String, nullable=True)
    hypotheses = Column(JSON, nullable=True) # List of strings
    
    task = relationship("ScanTask", back_populates="entities")
    responses = relationship("AiResponse", back_populates="entity", cascade="all, delete-orphan")

class AiResponse(Base):
    __tablename__ = "ai_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("scan_entities.id"))
    platform = Column(String, nullable=False) # Gemini, Perplexity, etc.
    content = Column(Text, nullable=True)
    status = Column(String, default="completed") # completed, error
    
    entity = relationship("ScanEntity", back_populates="responses")
