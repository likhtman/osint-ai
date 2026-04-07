from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from app.services.orchestrator import run_osint_analysis
from app.core.db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import ScanTask, ScanEntity
from sqlalchemy.orm import selectinload

router = APIRouter()


class AnalyzeRequest(BaseModel):
    queryText: str


@router.post("/analyze")
async def analyze_entities(req: AnalyzeRequest):
    return StreamingResponse(
        run_osint_analysis(req.queryText),
        media_type="text/event-stream"
    )


@router.get("/history")
async def get_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScanTask).order_by(ScanTask.created_at.desc()).limit(20)
    )
    return result.scalars().all()


@router.get("/scan/{task_id}")
async def get_scan_details(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ScanTask)
        .where(ScanTask.id == task_id)
        .options(
            selectinload(ScanTask.entities)
            .selectinload(ScanEntity.responses)
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Scan not found")
    return task
