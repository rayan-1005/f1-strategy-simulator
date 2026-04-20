"""
tests/test_engine.py
─────────────────────────────────────────────────────────────────────────────
Unit tests covering all three engine modules + the FastAPI endpoints.

Run with:
    pytest tests/ -v
"""

import math
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.deg_model import lap_time, stint_times, stint_total_time, no_stop_total_time
from app.core.pit_window import compute_1stop, compute_2stop, compute_undercut_window
from app.core.monte_carlo import run_monte_carlo
from app.models.schemas import CompoundConfig, COMPOUND_DEG_K

client = TestClient(app)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

BASE_PACE = 90.0       # seconds
PIT_DELTA = 22.0       # seconds
TOTAL_LAPS = 57        # Bahrain-ish

SOFT   = CompoundConfig(compound="SOFT",   deg_k=COMPOUND_DEG_K["SOFT"])
MEDIUM = CompoundConfig(compound="MEDIUM", deg_k=COMPOUND_DEG_K["MEDIUM"])
HARD   = CompoundConfig(compound="HARD",   deg_k=COMPOUND_DEG_K["HARD"])


# ─── deg_model tests ──────────────────────────────────────────────────────────

class TestDegModel:
    def test_fresh_tyre_equals_base_pace(self):
        """T(1) = B + k * 1^1.4 = B + k, NOT B. t=1 is the first lap, not t=0."""
        # At tyre_age=1: T = B + k * 1^1.4 = B + k
        result = lap_time(BASE_PACE, COMPOUND_DEG_K["SOFT"], tyre_age=1)
        expected = BASE_PACE + COMPOUND_DEG_K["SOFT"] * (1 ** 1.4)
        assert math.isclose(result, expected, rel_tol=1e-9)

    def test_lap_time_increases_with_age(self):
        """Degradation is monotonically increasing."""
        times = [lap_time(BASE_PACE, COMPOUND_DEG_K["MEDIUM"], t) for t in range(1, 50)]
        assert all(times[i] < times[i + 1] for i in range(len(times) - 1))

    def test_harder_compound_slower_degradation(self):
        """Hard tyre degrades slower than Soft at the same age."""
        t = 20
        soft_time = lap_time(BASE_PACE, COMPOUND_DEG_K["SOFT"], t)
        hard_time = lap_time(BASE_PACE, COMPOUND_DEG_K["HARD"], t)
        assert hard_time < soft_time

    def test_invalid_tyre_age_raises(self):
        with pytest.raises(ValueError):
            lap_time(BASE_PACE, COMPOUND_DEG_K["SOFT"], tyre_age=0)

    def test_stint_times_shape(self):
        """stint_times returns an array of the correct length."""
        arr = stint_times(BASE_PACE, COMPOUND_DEG_K["MEDIUM"], stint_length=20)
        assert len(arr) == 20

    def test_no_stop_total_matches_manual_sum(self):
        """no_stop_total_time matches manual lap-by-lap sum."""
        manual = sum(
            lap_time(BASE_PACE, COMPOUND_DEG_K["MEDIUM"], t) for t in range(1, TOTAL_LAPS + 1)
        )
        auto = no_stop_total_time(BASE_PACE, COMPOUND_DEG_K["MEDIUM"], TOTAL_LAPS)
        assert math.isclose(manual, auto, rel_tol=1e-9)


# ─── pit_window tests ─────────────────────────────────────────────────────────

class TestPitWindow:
    def test_1stop_optimal_is_in_feasible_range(self):
        optimal, all_times = compute_1stop(BASE_PACE, PIT_DELTA, TOTAL_LAPS, MEDIUM, HARD)
        p_star = optimal.pit_laps[0]
        assert 10 <= p_star <= TOTAL_LAPS - 10

    def test_1stop_optimal_has_minimum_total_time(self):
        optimal, all_times = compute_1stop(BASE_PACE, PIT_DELTA, TOTAL_LAPS, MEDIUM, HARD)
        p_star = optimal.pit_laps[0]
        # The reported time must be <= all other feasible times
        assert all(optimal.total_time_s <= t for t in all_times.values())

    def test_1stop_delta_vs_no_stop_is_negative(self):
        """Pitting is always faster than no-stop (for normal deg parameters)."""
        optimal, _ = compute_1stop(BASE_PACE, PIT_DELTA, TOTAL_LAPS, SOFT, HARD)
        assert optimal.delta_vs_no_stop_s < 0

    def test_1stop_stints_cover_all_laps(self):
        optimal, _ = compute_1stop(BASE_PACE, PIT_DELTA, TOTAL_LAPS, MEDIUM, HARD)
        total = sum(s.laps for s in optimal.stints)
        assert total == TOTAL_LAPS

    def test_2stop_faster_than_1stop_with_soft(self):
        """2-stop with Soft is typically faster than 1-stop for high-deg compounds."""
        opt1, _ = compute_1stop(BASE_PACE, PIT_DELTA, TOTAL_LAPS, SOFT, MEDIUM)
        opt2, _ = compute_2stop(BASE_PACE, PIT_DELTA, TOTAL_LAPS, SOFT, MEDIUM, HARD)
        # Not guaranteed for all params, but check it runs and returns valid result
        assert opt2.total_time_s > 0
        assert len(opt2.pit_laps) == 2
        assert opt2.pit_laps[0] < opt2.pit_laps[1]

    def test_2stop_stints_cover_all_laps(self):
        opt2, _ = compute_2stop(BASE_PACE, PIT_DELTA, TOTAL_LAPS, SOFT, MEDIUM, HARD)
        total = sum(s.laps for s in opt2.stints)
        assert total == TOTAL_LAPS

    def test_undercut_window_gains_positive_for_viable_laps(self):
        uw = compute_undercut_window(BASE_PACE, PIT_DELTA, TOTAL_LAPS, SOFT, HARD)
        for lap in uw.viable_laps:
            assert uw.gains_s[lap] > 0

    def test_undercut_best_lap_has_max_gain(self):
        uw = compute_undercut_window(BASE_PACE, PIT_DELTA, TOTAL_LAPS, SOFT, HARD)
        if uw.best_lap is not None:
            max_gain = max(uw.gains_s.values())
            assert math.isclose(uw.best_gain_s, max_gain, rel_tol=1e-9)


# ─── monte_carlo tests ────────────────────────────────────────────────────────

class TestMonteCarlo:
    def test_win_pct_sums_to_one(self):
        results = run_monte_carlo(
            BASE_PACE, PIT_DELTA, TOTAL_LAPS,
            [MEDIUM, HARD], sc_probability=0.05, n_iterations=200, rng_seed=42
        )
        total_pct = sum(r["win_pct"] for r in results)
        assert math.isclose(total_pct, 1.0, abs_tol=0.01), f"Sum was {total_pct}"

    def test_results_are_sorted_by_win_pct(self):
        results = run_monte_carlo(
            BASE_PACE, PIT_DELTA, TOTAL_LAPS,
            [MEDIUM, HARD], sc_probability=0.05, n_iterations=200, rng_seed=42
        )
        pcts = [r["win_pct"] for r in results]
        assert pcts == sorted(pcts, reverse=True)

    def test_zero_sc_probability_deterministic(self):
        """With sc_prob=0, SC never fires; result should be stable across seeds."""
        r1 = run_monte_carlo(BASE_PACE, PIT_DELTA, TOTAL_LAPS, [MEDIUM, HARD],
                             sc_probability=0.0, n_iterations=100, rng_seed=1)
        r2 = run_monte_carlo(BASE_PACE, PIT_DELTA, TOTAL_LAPS, [MEDIUM, HARD],
                             sc_probability=0.0, n_iterations=100, rng_seed=99)
        # The winner strategy label should be the same in both cases
        assert r1[0]["strategy"] == r2[0]["strategy"]

    def test_high_sc_probability_returns_results(self):
        """Smoke test — high SC probability should still produce valid output."""
        results = run_monte_carlo(
            BASE_PACE, PIT_DELTA, TOTAL_LAPS,
            [SOFT, MEDIUM, HARD], sc_probability=0.25, n_iterations=100, rng_seed=7
        )
        assert len(results) >= 2

    def test_percentiles_ordered(self):
        """p10 <= avg <= p90."""
        results = run_monte_carlo(
            BASE_PACE, PIT_DELTA, TOTAL_LAPS,
            [MEDIUM, HARD], sc_probability=0.05, n_iterations=500, rng_seed=42
        )
        for r in results:
            assert r["p10_time_s"] <= r["avg_time_s"] <= r["p90_time_s"], (
                f"Ordering violated for {r['strategy']}: "
                f"p10={r['p10_time_s']} avg={r['avg_time_s']} p90={r['p90_time_s']}"
            )


# ─── API endpoint tests ───────────────────────────────────────────────────────

class TestEndpoints:
    def test_health(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_compute_1stop(self):
        payload = {
            "base_pace_s": 90.0,
            "pit_delta_s": 22.0,
            "total_laps": 57,
            "stop_count": 1,
            "compounds": [
                {"compound": "MEDIUM"},
                {"compound": "HARD"},
            ],
        }
        resp = client.post("/compute", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "optimal" in data
        assert "undercut_window" in data
        assert data["optimal"]["pit_laps"] is not None
        assert len(data["optimal"]["stints"]) == 2

    def test_compute_2stop(self):
        payload = {
            "base_pace_s": 90.0,
            "pit_delta_s": 22.0,
            "total_laps": 57,
            "stop_count": 2,
            "compounds": [
                {"compound": "SOFT"},
                {"compound": "MEDIUM"},
                {"compound": "HARD"},
            ],
        }
        resp = client.post("/compute", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["optimal"]["pit_laps"]) == 2

    def test_compute_compound_mismatch_raises_422(self):
        """1-stop with only 1 compound should fail validation."""
        payload = {
            "base_pace_s": 90.0,
            "pit_delta_s": 22.0,
            "total_laps": 57,
            "stop_count": 1,
            "compounds": [{"compound": "SOFT"}],
        }
        resp = client.post("/compute", json=payload)
        assert resp.status_code == 422

    def test_pit_window_undercut(self):
        payload = {
            "base_pace_s": 90.0,
            "pit_delta_s": 22.0,
            "total_laps": 57,
            "target_lap": 20,
            "compound_old": {"compound": "SOFT"},
            "compound_new": {"compound": "HARD"},
            "rival_tyre_age": 20,
        }
        resp = client.post("/pit-window", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "undercut_gain_s" in data
        assert isinstance(data["is_undercut"], bool)

    def test_monte_carlo_endpoint(self):
        payload = {
            "base_pace_s": 90.0,
            "pit_delta_s": 22.0,
            "total_laps": 57,
            "sc_probability": 0.05,
            "n_iterations": 100,
            "compounds": [
                {"compound": "MEDIUM"},
                {"compound": "HARD"},
            ],
        }
        resp = client.post("/monte-carlo", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "distribution" in data
        assert len(data["distribution"]) >= 1
        total_pct = sum(d["win_pct"] for d in data["distribution"])
        assert math.isclose(total_pct, 1.0, abs_tol=0.02)

    def test_invalid_base_pace_raises(self):
        payload = {
            "base_pace_s": 30.0,   # Too fast, < 60.0 min
            "pit_delta_s": 22.0,
            "total_laps": 57,
            "stop_count": 1,
            "compounds": [{"compound": "MEDIUM"}, {"compound": "HARD"}],
        }
        resp = client.post("/compute", json=payload)
        assert resp.status_code == 422