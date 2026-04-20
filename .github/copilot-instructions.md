# Copilot Instructions for `f1-strategy-simulator`

## Build, test, and lint commands

### Infrastructure (from repo root)
- `docker compose up -d mongo redis` starts local MongoDB and Redis used by the API gateway.

### API gateway (`api-gateway/`)
- Install: `npm install`
- Build: `npm run build`
- Dev API server: `npm run dev`
- Dev Monte Carlo worker: `npm run dev:worker`
- Production start (after build): `npm run start`

There is currently **no lint script** and **no gateway test script** defined in `api-gateway/package.json`.

### Strategy engine (`strategy-engine/`)
- Install: `pip install -r requirements.txt`
- Run locally: `uvicorn app.main:app --reload --port 8000`
- Full tests: `pytest tests/ -v`
- Single test example: `pytest tests/test_engine.py::TestEndpoints::test_health -v`

## High-level architecture

This repo is a 3-part system:

1. **Strategy engine (Python/FastAPI)** in `strategy-engine/app` is the source of race-strategy computation.
   - Core algorithms live in `app/core/`:
     - `deg_model.py`: tyre degradation model (`T(t) = B + k * t^1.4`)
     - `pit_window.py`: 1-stop/2-stop optimization and undercut evaluation
     - `monte_carlo.py`: safety-car Monte Carlo simulation
   - HTTP contract is defined with Pydantic models in `app/models/schemas.py`.
   - API routes are implemented in `app/routers/strategy.py` (`/compute`, `/pit-window`, `/monte-carlo`, `/health`).

2. **API gateway (Node.js/Express + TypeScript)** in `api-gateway/src` fronts the strategy engine.
   - App composition and middleware wiring: `src/app.js`
   - Startup and dependency checks (Mongo + Redis): `src/index.ts`
   - Sync proxy routes: `src/routes/strategy.ts` (forwards to strategy engine)
   - Async Monte Carlo job routes: `src/routes/monte.ts` + `src/workers/monteWorker.ts` using BullMQ queue `"monte-carlo"`
   - Caching and throttling middleware use Redis: `src/middleware/cache.ts`, `src/middleware/rateLimit.ts`

3. **Frontend** currently has env scaffolding (`frontend/.env.example`) and empty `src/` feature folders; active runtime behavior is primarily backend/backend-integration focused.

## Key conventions in this codebase

- **Engine is canonical for strategy math and validation.** Gateway should proxy computation to the engine, not re-implement core formulas.
- **TypeScript NodeNext style is required in gateway imports.** Source files use ESM with explicit `.js` import suffixes even in `.ts` files (see `api-gateway/tsconfig.json` + `src/*.ts`).
- **Environment config is schema-validated at startup.**
  - Gateway: Zod schema in `api-gateway/src/config/env.js`.
  - Engine: request/response contracts and bounds are Pydantic models in `strategy-engine/app/models/schemas.py`.
- **Monte Carlo has two paths by design:**
  - synchronous pass-through at `POST /api/strategy/monte-carlo`
  - asynchronous queue workflow at `POST /api/monte/run` + `GET /api/monte/result/:jobId` (BullMQ worker required).
- **`/api/strategy/compute` trims heavy scan payloads by default.** Full scan arrays (`all_1stop_times`, `all_2stop_times`) are nulled unless query parameter `include_scans=true` is supplied.
- **Redis failures are intentionally non-fatal in middleware paths.** Rate limiting and caching degrade gracefully when Redis is unavailable.
- **Domain constraints are centralized constants.** Compound degradation defaults and lap/stint limits come from `strategy-engine/app/models/schemas.py` (`COMPOUND_DEG_K`, `MIN_STINT_LAPS`, request bounds).

## Imported from `.github/skills.md` (frontend-design skill)

When working on frontend UI in this repository:

- Prioritize **distinctive, production-grade interfaces** over generic component styling.
- Start by locking a clear aesthetic direction (tone, purpose, constraints, differentiation) and execute it consistently.
- Focus design quality on:
  - Typography choices (avoid generic defaults)
  - Cohesive color system (prefer strong direction over neutral, indistinct palettes)
  - Motion and interaction polish (high-impact entry/hover/scroll moments)
  - Spatial composition (intentional layout choices, including asymmetry when suitable)
  - Background/detail treatment (depth, texture, atmosphere where it serves the concept)
- Avoid repetitive AI-looking patterns and cookie-cutter UI choices.
- Match implementation complexity to the chosen design language (maximal concepts can be rich/animated; minimalist concepts should be precise and restrained).
