from fastapi import APIRouter, Request
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from app.services.orchestrator import run_osint_analysis

router = APIRouter()

class AnalyzeRequest(BaseModel):
    queryText: str

@router.post("/analyze")
async def analyze_entities(req: AnalyzeRequest):
    # Streaming response using Server-Sent Events format
    return StreamingResponse(
        run_osint_analysis(req.queryText),
        media_type="text/event-stream"
    )
