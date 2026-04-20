"""
routers/strategy.py
─────────────────────────────────────────────────────────────────────────────
FastAPI router implementing all strategy engine endpoints:
  POST /compute       — synchronous pit window computation
  POST /pit-window    — single-lap undercut/overcut query
  POST /monte-carlo   — Monte Carlo safety car simulation
  GET  /health        — health check
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    ComputeRequest,
    ComputeResponse,
    PitWindowRequest,
    PitWindowResponse,
    MonteCarloRequest,
    MonteCarloResponse,
    StrategyDistribution,
    HealthResponse,
)
from app.core.pit_window import (
    compute_1stop,
    compute_2stop,
    compute_undercut_window,
    evaluate_pit_window,
)
from app.core.monte_carlo import run_monte_carlo
from app.core.deg_model import no_stop_total_time

router = APIRouter()


# ─── POST /compute ─────────────────────────────────────────────────────────────

@router.post("/compute", response_model=ComputeResponse, summary="Compute optimal pit strategy")
def compute_strategy(req: ComputeRequest) -> ComputeResponse:
    """
    Compute the optimal pit window for a 1-stop or 2-stop strategy.

    Also returns undercut window data and the full time scan for chart rendering.
    Response time target: < 3s for any valid input (brute-force O(L) or O(L²)).
    """
    compounds = req.compounds

    # ── Validate compound count vs stop_count ─────────────────────────────────
    required = req.stop_count + 1  # 1-stop needs 2 compounds, 2-stop needs 3
    if len(compounds) < required:
        raise HTTPException(
            status_code=422,
            detail=(
                f"stop_count={req.stop_count} requires at least {required} compounds, "
                f"got {len(compounds)}."
            ),
        )

    # ── Run optimizer ─────────────────────────────────────────────────────────
    all_1stop: dict[int, float] | None = None
    all_2stop: dict[str, float] | None = None

    if req.stop_count == 1:
        optimal, all_1stop = compute_1stop(
            base_pace_s=req.base_pace_s,
            pit_delta_s=req.pit_delta_s,
            total_laps=req.total_laps,
            compound_1=compounds[0],
            compound_2=compounds[1],
        )
    else:
        optimal, all_2stop = compute_2stop(
            base_pace_s=req.base_pace_s,
            pit_delta_s=req.pit_delta_s,
            total_laps=req.total_laps,
            compound_1=compounds[0],
            compound_2=compounds[1],
            compound_3=compounds[2],
        )

    # ── Undercut window (always computed for the first pit stop) ──────────────
    undercut_window = compute_undercut_window(
        base_pace_s=req.base_pace_s,
        pit_delta_s=req.pit_delta_s,
        total_laps=req.total_laps,
        compound_old=compounds[0],
        compound_new=compounds[1],
    )

    return ComputeResponse(
        optimal=optimal,
        undercut_window=undercut_window,
        all_1stop_times=all_1stop,
        all_2stop_times=all_2stop,
    )


# ─── POST /pit-window ─────────────────────────────────────────────────────────

@router.post(
    "/pit-window",
    response_model=PitWindowResponse,
    summary="Evaluate undercut/overcut for a specific lap",
)
def pit_window_query(req: PitWindowRequest) -> PitWindowResponse:
    """
    Given a target pit lap and a rival's current tyre age, determine whether
    pitting now constitutes an undercut (net gain > 0) or an overcut (net gain < 0).

    Uses a static rival model: rival does not react to your pit stop.
    """
    if req.target_lap < 1 or req.target_lap > req.total_laps:
        raise HTTPException(
            status_code=422,
            detail=f"target_lap must be between 1 and {req.total_laps}.",
        )

    result = evaluate_pit_window(
        base_pace_s=req.base_pace_s,
        pit_delta_s=req.pit_delta_s,
        target_lap=req.target_lap,
        compound_old=req.compound_old,
        compound_new=req.compound_new,
        rival_tyre_age=req.rival_tyre_age,
    )
    return PitWindowResponse(**result)


# ─── POST /monte-carlo ────────────────────────────────────────────────────────

@router.post(
    "/monte-carlo",
    response_model=MonteCarloResponse,
    summary="Run Monte Carlo safety car simulation",
)
def monte_carlo(req: MonteCarloRequest) -> MonteCarloResponse:
    """
    Runs N Monte Carlo iterations, each assigning random SC events per lap
    based on sc_probability. Returns strategy win-percentage distribution.

    Computation budget: ~1-2s for N=1000 in Python. N is capped at 5000.
    """
    if len(req.compounds) < 2:
        raise HTTPException(status_code=422, detail="At least 2 compounds required.")

    distribution_raw = run_monte_carlo(
        base_pace_s=req.base_pace_s,
        pit_delta_s=req.pit_delta_s,
        total_laps=req.total_laps,
        compounds=req.compounds,
        sc_probability=req.sc_probability,
        n_iterations=req.n_iterations,
    )

    distribution = [StrategyDistribution(**d) for d in distribution_raw]

    # Baseline optimal lap under no-SC conditions (for reference in chart)
    from app.core.pit_window import compute_1stop
    baseline_optimal, _ = compute_1stop(
        base_pace_s=req.base_pace_s,
        pit_delta_s=req.pit_delta_s,
        total_laps=req.total_laps,
        compound_1=req.compounds[0],
        compound_2=req.compounds[1],
    )

    return MonteCarloResponse(
        n_iterations=req.n_iterations,
        sc_probability=req.sc_probability,
        distribution=distribution,
        baseline_no_sc_optimal_lap=baseline_optimal.pit_laps[0],
    )


# ─── GET /health ──────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse, summary="Health check")
def health() -> HealthResponse:
    return HealthResponse()