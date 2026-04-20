from pydantic import BaseModel, Field, model_validator
from typing import Literal

# ─── Constants ────────────────────────────────────────────────────────────────

COMPOUND_DEG_K: dict[str, float] = {
    "SOFT": 0.085,
    "MEDIUM": 0.045,
    "HARD": 0.022,
}

MIN_STINT_LAPS = 10
DEG_EXPONENT = 1.4

Compound = Literal["SOFT", "MEDIUM", "HARD"]

# ─── Shared sub-models ────────────────────────────────────────────────────────

class CompoundConfig(BaseModel):
    compound: Compound
    deg_k: float = Field(
        default=None,
        description="Degradation coefficient (s/lap^1.4). Uses compound default if omitted.",
        ge=0.005,
        le=0.3,
    )

    @model_validator(mode="after")
    def fill_default_k(self) -> "CompoundConfig":
        if self.deg_k is None:
            self.deg_k = COMPOUND_DEG_K[self.compound]
        return self


class StintResult(BaseModel):
    compound: Compound
    start_lap: int
    end_lap: int
    laps: int


class OptimalStop(BaseModel):
    pit_laps: list[int] = Field(description="Lap number(s) at which to pit.")
    stints: list[StintResult]
    total_time_s: float
    delta_vs_no_stop_s: float


class UndercutWindow(BaseModel):
    viable_laps: list[int] = Field(description="Laps at which undercut gain > 0.")
    gains_s: dict[int, float] = Field(description="Net gain in seconds per candidate lap.")
    best_lap: int | None = None
    best_gain_s: float | None = None


# ─── /compute ─────────────────────────────────────────────────────────────────

class ComputeRequest(BaseModel):
    base_pace_s: float = Field(
        ...,
        description="Fastest lap time on a new tyre (seconds).",
        gt=60.0,
        lt=200.0,
    )
    pit_delta_s: float = Field(
        ...,
        description="Time lost in the pit lane (seconds).",
        gt=10.0,
        lt=40.0,
    )
    total_laps: int = Field(..., ge=30, le=80)
    stop_count: Literal[1, 2] = Field(default=1, description="Number of pit stops.")
    compounds: list[CompoundConfig] = Field(
        ...,
        min_length=2,
        max_length=3,
        description="Compounds available, in stint order.",
    )


class ComputeResponse(BaseModel):
    optimal: OptimalStop
    undercut_window: UndercutWindow
    all_1stop_times: dict[int, float] | None = Field(
        default=None,
        description="Total race time for every feasible 1-stop pit lap (for chart rendering).",
    )
    all_2stop_times: dict[str, float] | None = Field(
        default=None,
        description="Total race time for every feasible 2-stop combo (key = 'P1,P2').",
    )


# ─── /pit-window ──────────────────────────────────────────────────────────────

class PitWindowRequest(BaseModel):
    base_pace_s: float = Field(..., gt=60.0, lt=200.0)
    pit_delta_s: float = Field(..., gt=10.0, lt=40.0)
    total_laps: int = Field(..., ge=30, le=80)
    target_lap: int = Field(..., description="The specific lap to evaluate.")
    compound_old: CompoundConfig
    compound_new: CompoundConfig
    rival_tyre_age: int = Field(
        ...,
        ge=1,
        description="Rival's current tyre age in laps (for undercut calc).",
    )


class PitWindowResponse(BaseModel):
    target_lap: int
    undercut_gain_s: float = Field(description="Net gain if you pit on target_lap. Positive = gain.")
    is_undercut: bool
    is_overcut: bool
    rival_predicted_lap_time_s: float
    self_out_lap_time_s: float


# ─── /monte-carlo ─────────────────────────────────────────────────────────────

class MonteCarloRequest(BaseModel):
    base_pace_s: float = Field(..., gt=60.0, lt=200.0)
    pit_delta_s: float = Field(..., gt=10.0, lt=40.0)
    total_laps: int = Field(..., ge=30, le=80)
    sc_probability: float = Field(
        default=0.05,
        ge=0.0,
        le=0.3,
        description="Per-lap safety car probability.",
    )
    n_iterations: int = Field(default=1000, ge=100, le=5000)
    compounds: list[CompoundConfig] = Field(..., min_length=2, max_length=3)


class StrategyDistribution(BaseModel):
    strategy: str = Field(description="Human-readable label, e.g. '1-stop P28 M→H'.")
    pit_laps: list[int]
    win_pct: float
    avg_time_s: float
    p10_time_s: float
    p90_time_s: float


class MonteCarloResponse(BaseModel):
    n_iterations: int
    sc_probability: float
    distribution: list[StrategyDistribution]
    baseline_no_sc_optimal_lap: int


# ─── /health ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"