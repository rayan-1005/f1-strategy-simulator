"""
main.py
─────────────────────────────────────────────────────────────────────────────
F1 Strategy Simulator — Strategy Engine
FastAPI application entry point.

Run locally:
    uvicorn app.main:app --reload --port 8000

OpenAPI docs available at:
    http://localhost:8000/docs     (Swagger UI)
    http://localhost:8000/redoc   (ReDoc)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.strategy import router

# ─── App init ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="F1 Strategy Simulator — Strategy Engine",
    description=(
        "Mathematical strategy engine for F1 race pit stop optimization. "
        "Implements tire degradation modeling (T(t) = B + k·t^1.4), "
        "brute-force pit window search, undercut/overcut detection, "
        "and Monte Carlo safety car simulation."
    ),
    version="1.0.0",
    contact={"name": "Rayan"},
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT"
    },
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
# In production, restrict origins to the deployed Vercel frontend URL.
# In dev, allow all origins for ease of local iteration.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───────────────────────────────────────────────────────────────────

app.include_router(router, tags=["Strategy Engine"])