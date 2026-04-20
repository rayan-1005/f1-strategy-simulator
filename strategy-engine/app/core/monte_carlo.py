"""
monte_carlo.py
─────────────────────────────────────────────────────────────────────────────
Monte Carlo simulation for safety car-impacted race strategies.

Algorithm (from SDD §4.4):
─────────────────────────
for i in range(N):
    sc_laps = {lap : random() < sc_probability for lap in 1..L}
    for each candidate_strategy:
        time = compute_time(strategy, sc_laps)
        # Free pit if pit_lap falls inside an SC window
    winner = strategy with minimum time in iteration i
    win_counts[winner] += 1

Output:
    win_pct[s] = win_counts[s] / N

Safety Car effect on timing
────────────────────────────
When an SC is deployed on lap P:
  - Laps under SC are driven at SC_LAP_TIME (fixed slow lap).
  - SC_DURATION laps after the trigger lap are slow.
  - A pit stop taken during an SC window costs only SC_PIT_DELTA
    (pit lane speed-limit only, no time lost to track position).
"""

from __future__ import annotations

import numpy as np

from app.core.deg_model import lap_time as _lap_time
from app.models.schemas import CompoundConfig, MIN_STINT_LAPS

# ─── Safety Car Constants ──────────────────────────────────────────────────────

SC_LAP_TIME_DELTA_S: float = 30.0   # extra seconds per SC lap vs. normal racing
SC_DURATION_LAPS: int = 3            # how many laps the SC stays out
SC_PIT_DELTA_S: float = 5.0          # effective pit delta during SC (just pit-lane speed limit)

# ─── Candidate Strategy Builder ───────────────────────────────────────────────

def _build_candidates(
    total_laps: int,
    compounds: list[CompoundConfig],
) -> list[dict]:
    """
    Enumerate all 1-stop candidates across the feasible pit window.
    Each candidate = { label, pit_laps, compounds }.

    For 2-stop, we enumerate (P1, P2) pairs but that blows up quickly for MC —
    so we only evaluate the top 3 1-stop candidates plus the globally optimal
    2-stop from a quick pre-scan. In practice this covers all realistic options.
    """
    c1 = compounds[0]
    c2 = compounds[1]
    c3 = compounds[2] if len(compounds) > 2 else None

    candidates = []

    # ── All feasible 1-stop laps ──────────────────────────────────────────────
    for p in range(MIN_STINT_LAPS, total_laps - MIN_STINT_LAPS + 1):
        label = f"1-stop P{p} {c1.compound[:1]}→{c2.compound[:1]}"
        candidates.append(
            {
                "label": label,
                "pit_laps": [p],
                "compounds": [c1, c2],
            }
        )

    # ── Sample 2-stop strategies (every 5 laps to keep MC fast) ──────────────
    if c3 is not None:
        step = 5
        for p1 in range(MIN_STINT_LAPS, total_laps - 2 * MIN_STINT_LAPS + 1, step):
            for p2 in range(p1 + MIN_STINT_LAPS, total_laps - MIN_STINT_LAPS + 1, step):
                label = f"2-stop P{p1},{p2} {c1.compound[:1]}→{c2.compound[:1]}→{c3.compound[:1]}"
                candidates.append(
                    {
                        "label": label,
                        "pit_laps": [p1, p2],
                        "compounds": [c1, c2, c3],
                    }
                )

    return candidates


# ─── Race Time Calculator ──────────────────────────────────────────────────────

def _compute_race_time(
    base_pace_s: float,
    pit_delta_s: float,
    total_laps: int,
    strategy: dict,
    sc_laps: set[int],
) -> float:
    """
    Compute total race time for a strategy under a particular SC scenario.

    Strategy dict fields:
        pit_laps   : list[int]
        compounds  : list[CompoundConfig]
    """
    pit_laps: list[int] = strategy["pit_laps"]
    compound_seq: list[CompoundConfig] = strategy["compounds"]

    # Build tyre stint boundaries
    boundaries = [0] + pit_laps + [total_laps]  # lap ranges [b[i]+1 .. b[i+1]]
    total_time = 0.0
    tyre_age = 1

    # SC bookkeeping: expand each SC trigger into a window
    sc_window: set[int] = set()
    for trigger in sc_laps:
        for offset in range(SC_DURATION_LAPS):
            sc_window.add(trigger + offset)

    current_compound_idx = 0
    current_tyre_age = 1

    for stint_idx, (start, end) in enumerate(
        zip(boundaries[:-1], boundaries[1:])
    ):
        compound = compound_seq[min(stint_idx, len(compound_seq) - 1)]
        current_tyre_age = 1  # fresh tyre at start of each stint

        for lap in range(start + 1, end + 1):
            if lap in sc_window:
                # Drive slow SC lap (no degradation counted)
                total_time += base_pace_s + SC_LAP_TIME_DELTA_S
            else:
                total_time += _lap_time(base_pace_s, compound.deg_k, current_tyre_age)
            current_tyre_age += 1

        # Add pit delta at end of stint (except after last stint)
        if stint_idx < len(pit_laps):
            pit_lap_num = pit_laps[stint_idx]
            if pit_lap_num in sc_window:
                total_time += SC_PIT_DELTA_S   # free pit under SC
            else:
                total_time += pit_delta_s

    return total_time


# ─── Main Monte Carlo Runner ──────────────────────────────────────────────────

def run_monte_carlo(
    base_pace_s: float,
    pit_delta_s: float,
    total_laps: int,
    compounds: list[CompoundConfig],
    sc_probability: float,
    n_iterations: int,
    rng_seed: int | None = None,
) -> list[dict]:
    """
    Run the Monte Carlo simulation.

    Returns
    -------
    list of dicts with keys matching StrategyDistribution:
        strategy, pit_laps, win_pct, avg_time_s, p10_time_s, p90_time_s
    Sorted descending by win_pct.
    """
    rng = np.random.default_rng(rng_seed)
    candidates = _build_candidates(total_laps, compounds)
    n_candidates = len(candidates)

    win_counts = np.zeros(n_candidates, dtype=np.int64)
    # Store per-iteration times for percentile computation
    all_times = np.zeros((n_candidates, n_iterations), dtype=np.float64)

    for i in range(n_iterations):
        # Determine which laps have SC events
        sc_mask = rng.random(total_laps) < sc_probability
        sc_laps: set[int] = {lap + 1 for lap, triggered in enumerate(sc_mask) if triggered}

        iter_times = np.empty(n_candidates)
        for j, candidate in enumerate(candidates):
            iter_times[j] = _compute_race_time(
                base_pace_s, pit_delta_s, total_laps, candidate, sc_laps
            )

        winner_idx = int(np.argmin(iter_times))
        win_counts[winner_idx] += 1
        all_times[:, i] = iter_times

    # Build output — only return strategies with at least 1 win or top 5
    results = []
    for j, candidate in enumerate(candidates):
        results.append(
            {
                "strategy": candidate["label"],
                "pit_laps": candidate["pit_laps"],
                "win_pct": round(float(win_counts[j]) / n_iterations, 4),
                "avg_time_s": round(float(np.mean(all_times[j])), 3),
                "p10_time_s": round(float(np.percentile(all_times[j], 10)), 3),
                "p90_time_s": round(float(np.percentile(all_times[j], 90)), 3),
            }
        )

    # Return strategies with any wins, sorted by win_pct desc; min 2 returned
    winners = [r for r in results if r["win_pct"] > 0]
    if len(winners) < 2:
        # Fall back to top 5 by average time
        winners = sorted(results, key=lambda r: r["avg_time_s"])[:5]
    else:
        winners = sorted(winners, key=lambda r: r["win_pct"], reverse=True)

    return winners