from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.db import engine, Base
from app.services.llm_clients import close_http_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: close shared HTTP client
    await close_http_client()


app = FastAPI(title="OSINT AI Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"status": "ok", "message": "OSINT AI Agent API is running"}
