"""
deg_model.py
─────────────────────────────────────────────────────────────────────────────
Lap-time degradation model:

    T(t) = B + k * t^1.4

Where
  T(t)  = predicted lap time in seconds at tyre age t (laps)
  B     = base pace (fastest lap on a brand-new tyre, in seconds)
  k     = compound-specific degradation coefficient
  t     = tyre age in laps (1-indexed, so first lap on a tyre is t=1)
  1.4   = empirically fitted exponent (range 1.3-1.5 across compounds)

The exponent is fixed at 1.4 for V1. Future work: per-compound exponents
fitted from actual Ergast regression data.
"""

import numpy as np

DEG_EXPONENT: float = 1.4


def lap_time(base_pace_s: float, deg_k: float, tyre_age: int) -> float:
    """
    Predict lap time for a single tyre age.

    Parameters
    ----------
    base_pace_s : float
        Fastest achievable lap time on a fresh tyre (seconds).
    deg_k : float
        Degradation coefficient (seconds / lap^DEG_EXPONENT).
    tyre_age : int
        Tyre age in laps (1 = first lap on the tyre).

    Returns
    -------
    float
        Predicted lap time in seconds.
    """
    if tyre_age < 1:
        raise ValueError(f"tyre_age must be >= 1, got {tyre_age}")
    return base_pace_s + deg_k * (tyre_age ** DEG_EXPONENT)


def stint_times(
    base_pace_s: float,
    deg_k: float,
    stint_length: int,
    start_tyre_age: int = 1,
) -> np.ndarray:
    """
    Return predicted lap times for an entire stint as a NumPy array.

    Parameters
    ----------
    base_pace_s : float
    deg_k : float
    stint_length : int
        Number of laps in this stint.
    start_tyre_age : int
        Tyre age at the FIRST lap of the stint. Defaults to 1 (fresh tyre).

    Returns
    -------
    np.ndarray, shape (stint_length,)
        Predicted lap time for each lap in the stint.
    """
    ages = np.arange(start_tyre_age, start_tyre_age + stint_length, dtype=float)
    return base_pace_s + deg_k * (ages ** DEG_EXPONENT)


def stint_total_time(
    base_pace_s: float,
    deg_k: float,
    stint_length: int,
    start_tyre_age: int = 1,
) -> float:
    """
    Sum of all predicted lap times for a stint.

    This is the primary input to the pit window optimizer.
    """
    return float(np.sum(stint_times(base_pace_s, deg_k, stint_length, start_tyre_age)))


def no_stop_total_time(base_pace_s: float, deg_k: float, total_laps: int) -> float:
    """
    Predicted total race time with zero pit stops (baseline for delta calc).
    """
    return stint_total_time(base_pace_s, deg_k, total_laps, start_tyre_age=1)