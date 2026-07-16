from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers.api import router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await init_db()
    except Exception as exc:
        # Allow API to start without DB (analyze/explain still work).
        print(f"Warning: database init failed: {exc}")
    yield


app = FastAPI(
    title="ChessMind API",
    description="Chess move analysis and coaching explanations",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
