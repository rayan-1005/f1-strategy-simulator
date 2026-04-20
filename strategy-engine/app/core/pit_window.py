"""
pit_window.py
─────────────────────────────────────────────────────────────────────────────
Optimal pit window computation and undercut / overcut detection.

1-stop strategy total time
--------------------------
Time_1stop(P) = Σ T_c1(t) for t in 1..P          # stint 1
              + pit_delta                           # pit stop loss
              + Σ T_c2(t) for t in 1..(L-P)        # stint 2

Optimal P* = argmin over P in [MIN_STINT, L - MIN_STINT]

2-stop strategy total time
--------------------------
Time_2stop(P1, P2) = Σ T_c1(t) t in 1..P1
                   + pit_delta
                   + Σ T_c2(t) t in 1..(P2-P1)
                   + pit_delta
                   + Σ T_c3(t) t in 1..(L-P2)

Search space: all (P1, P2) with P1 < P2, all stints ≥ MIN_STINT.

Undercut gain at lap P
-----------------------
undercut_gain(P) = T_rival(lap P, rival_tyre_age)  # rival lap on old tyre
                 - T_self(1)                         # self out-lap on fresh tyre
                 - pit_delta                         # self pit lane loss

Undercut is viable when undercut_gain(P) > 0.
This assumes a static rival model (rival does not react in V1).
"""

from __future__ import annotations

import numpy as np

from app.core.deg_model import lap_time, stint_total_time, no_stop_total_time
from app.models.schemas import (
    MIN_STINT_LAPS,
    CompoundConfig,
    OptimalStop,
    StintResult,
    UndercutWindow,
)


# ─── 1-Stop Optimizer ─────────────────────────────────────────────────────────

def compute_1stop(
    base_pace_s: float,
    pit_delta_s: float,
    total_laps: int,
    compound_1: CompoundConfig,
    compound_2: CompoundConfig,
) -> tuple[OptimalStop, dict[int, float]]:
    """
    Brute-force search over all feasible 1-stop pit laps.

    Returns
    -------
    optimal : OptimalStop
    all_times : dict[pit_lap -> total_race_time]
        Full scan results, useful for the lap-time chart on the frontend.
    """
    baseline = no_stop_total_time(base_pace_s, compound_1.deg_k, total_laps)

    feasible = range(MIN_STINT_LAPS, total_laps - MIN_STINT_LAPS + 1)
    all_times: dict[int, float] = {}

    best_pit_lap = -1
    best_time = float("inf")

    for p in feasible:
        stint1 = stint_total_time(base_pace_s, compound_1.deg_k, stint_length=p)
        stint2 = stint_total_time(base_pace_s, compound_2.deg_k, stint_length=total_laps - p)
        total = stint1 + pit_delta_s + stint2
        all_times[p] = round(total, 4)
        if total < best_time:
            best_time = total
            best_pit_lap = p

    optimal = OptimalStop(
        pit_laps=[best_pit_lap],
        stints=[
            StintResult(
                compound=compound_1.compound,
                start_lap=1,
                end_lap=best_pit_lap,
                laps=best_pit_lap,
            ),
            StintResult(
                compound=compound_2.compound,
                start_lap=best_pit_lap + 1,
                end_lap=total_laps,
                laps=total_laps - best_pit_lap,
            ),
        ],
        total_time_s=round(best_time, 4),
        delta_vs_no_stop_s=round(best_time - baseline, 4),
    )
    return optimal, all_times


# ─── 2-Stop Optimizer ─────────────────────────────────────────────────────────

def compute_2stop(
    base_pace_s: float,
    pit_delta_s: float,
    total_laps: int,
    compound_1: CompoundConfig,
    compound_2: CompoundConfig,
    compound_3: CompoundConfig,
) -> tuple[OptimalStop, dict[str, float]]:
    """
    Brute-force search over all feasible (P1, P2) 2-stop combinations.
    O(L²) — for a 70-lap race that's ~2500 iterations, fast enough.

    Returns
    -------
    optimal : OptimalStop
    all_times : dict["P1,P2" -> total_race_time]
    """
    baseline = no_stop_total_time(base_pace_s, compound_1.deg_k, total_laps)

    all_times: dict[str, float] = {}
    best_p1, best_p2 = -1, -1
    best_time = float("inf")

    for p1 in range(MIN_STINT_LAPS, total_laps - 2 * MIN_STINT_LAPS + 1):
        # Precompute stint-1 time (invariant in inner loop)
        s1 = stint_total_time(base_pace_s, compound_1.deg_k, stint_length=p1)

        for p2 in range(p1 + MIN_STINT_LAPS, total_laps - MIN_STINT_LAPS + 1):
            s2 = stint_total_time(base_pace_s, compound_2.deg_k, stint_length=p2 - p1)
            s3 = stint_total_time(base_pace_s, compound_3.deg_k, stint_length=total_laps - p2)
            total = s1 + pit_delta_s + s2 + pit_delta_s + s3
            key = f"{p1},{p2}"
            all_times[key] = round(total, 4)
            if total < best_time:
                best_time = total
                best_p1, best_p2 = p1, p2

    optimal = OptimalStop(
        pit_laps=[best_p1, best_p2],
        stints=[
            StintResult(
                compound=compound_1.compound,
                start_lap=1,
                end_lap=best_p1,
                laps=best_p1,
            ),
            StintResult(
                compound=compound_2.compound,
                start_lap=best_p1 + 1,
                end_lap=best_p2,
                laps=best_p2 - best_p1,
            ),
            StintResult(
                compound=compound_3.compound,
                start_lap=best_p2 + 1,
                end_lap=total_laps,
                laps=total_laps - best_p2,
            ),
        ],
        total_time_s=round(best_time, 4),
        delta_vs_no_stop_s=round(best_time - baseline, 4),
    )
    return optimal, all_times


# ─── Undercut Window ──────────────────────────────────────────────────────────

def compute_undercut_window(
    base_pace_s: float,
    pit_delta_s: float,
    total_laps: int,
    compound_old: CompoundConfig,
    compound_new: CompoundConfig,
    rival_tyre_age_at_lap1: int = 10,
) -> UndercutWindow:
    """
    Compute the undercut gain at every feasible pit lap.

    undercut_gain(P) = rival_lap_time(P, rival_age + P - 1)
                     - self_out_lap_time(1)               [first lap on new tyre]
                     - pit_delta_s

    Positive gain means pitting at lap P yields a net time advantage
    over the rival after both have completed that lap.

    Parameters
    ----------
    rival_tyre_age_at_lap1 : int
        Rival's tyre age at the start of lap 1 of our simulation window.
        Default 10 = rival is already 10 laps into a stint.
    """
    self_out_lap = lap_time(base_pace_s, compound_new.deg_k, tyre_age=1)
    feasible = range(MIN_STINT_LAPS, total_laps - MIN_STINT_LAPS + 1)

    gains: dict[int, float] = {}
    viable: list[int] = []

    for p in feasible:
        rival_age = rival_tyre_age_at_lap1 + (p - 1)
        rival_lap = lap_time(base_pace_s, compound_old.deg_k, tyre_age=rival_age)
        gain = rival_lap - self_out_lap - pit_delta_s
        gain_rounded = round(gain, 4)
        gains[p] = gain_rounded
        if gain > 0:
            viable.append(p)

    best_lap = max(viable, key=lambda p: gains[p]) if viable else None
    best_gain = gains[best_lap] if best_lap else None

    return UndercutWindow(
        viable_laps=viable,
        gains_s=gains,
        best_lap=best_lap,
        best_gain_s=best_gain,
    )


# ─── Single Pit-Window Query ──────────────────────────────────────────────────

def evaluate_pit_window(
    base_pace_s: float,
    pit_delta_s: float,
    target_lap: int,
    compound_old: CompoundConfig,
    compound_new: CompoundConfig,
    rival_tyre_age: int,
) -> dict:
    """
    Evaluate undercut/overcut for a single target lap against a rival.

    Returns a dict matching PitWindowResponse fields.
    """
    rival_lap_time = lap_time(base_pace_s, compound_old.deg_k, tyre_age=rival_tyre_age)
    self_out_lap_time = lap_time(base_pace_s, compound_new.deg_k, tyre_age=1)
    gain = rival_lap_time - self_out_lap_time - pit_delta_s

    return {
        "target_lap": target_lap,
        "undercut_gain_s": round(gain, 4),
        "is_undercut": gain > 0,
        "is_overcut": gain < 0,
        "rival_predicted_lap_time_s": round(rival_lap_time, 4),
        "self_out_lap_time_s": round(self_out_lap_time, 4),
    }