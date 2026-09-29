import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.materials import router as materials_router

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app = FastAPI(
    title="PathWise API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    materials_router,
    prefix="/materials",
    tags=["Materials"]
)


@app.get("/")
def root():
    return {
        "message": "Welcome to PathWise"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
