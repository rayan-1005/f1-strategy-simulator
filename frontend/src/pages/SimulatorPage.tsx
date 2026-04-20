import { useEffect, useMemo, useState } from "react";
import { DeltaBadge } from "../components/DeltaBadge";
import { LapTimeChart } from "../components/LapTimeChart";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { RaceSelector } from "../components/RaceSelector";
import { StrategyBadge } from "../components/StrategyBadge";
import { StrategyTimeline } from "../components/StrategyTimeline";
import { TelemetryCard } from "../components/TelemetryCard";
import { TelemetrySlider } from "../components/TelemetrySlider";
import { UndercutChart } from "../components/UndercutChart";
import { getRacePresetById, useRaceStore } from "../stores/useRaceStore";
import { useSimStore } from "../stores/useSimStore";
import type { Compound } from "../types";

const DEG_EXPONENT = 1.4;
const COMPOUND_K: Record<Compound, number> = {
  SOFT: 0.085,
  MEDIUM: 0.045,
  HARD: 0.022,
};

export function SimulatorPage() {
  const [autoRun, setAutoRun] = useState(true);
  const selectedRaceId = useRaceStore((s) => s.selectedRaceId);
  const race = useMemo(() => getRacePresetById(selectedRaceId), [selectedRaceId]);

  const {
    basePace,
    pitDelta,
    totalLaps,
    stopCount,
    compounds,
    isLoading,
    error,
    result,
    setBasePace,
    setPitDelta,
    setTotalLaps,
    setStopCount,
    setCompoundAt,
    hydrateFromRace,
    compute,
  } = useSimStore();

  useEffect(() => {
    hydrateFromRace(race.basePace, race.pitDelta, race.totalLaps, [
      race.defaultCompounds[0],
      race.defaultCompounds[1],
      race.defaultCompounds[2],
    ]);
  }, [race, hydrateFromRace]);

  useEffect(() => {
    if (!autoRun) return;
    const timer = setTimeout(() => {
      void compute();
    }, 300);
    return () => clearTimeout(timer);
  }, [autoRun, basePace, pitDelta, totalLaps, stopCount, compounds, compute]);

  const compoundSeries = useMemo(() => {
    return Array.from({ length: totalLaps }, (_, index) => {
      const lap = index + 1;
      return {
        lap,
        soft: basePace + COMPOUND_K.SOFT * lap ** DEG_EXPONENT,
        medium: basePace + COMPOUND_K.MEDIUM * lap ** DEG_EXPONENT,
        hard: basePace + COMPOUND_K.HARD * lap ** DEG_EXPONENT,
      };
    });
  }, [basePace, totalLaps]);

  const undercutPoints = useMemo(() => {
    if (!result?.undercut_window) return [];
    return Object.entries(result.undercut_window.gains_s).map(([lap, gain]) => ({
      lap: Number(lap),
      gain,
    }));
  }, [result]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{race.label}</div>
          <div className="page-meta">
            <span>Round {race.round}</span>
            <span>{race.totalLaps} Laps</span>
            <span>Base pace {basePace.toFixed(1)}s</span>
            <span>Pit Δ {pitDelta.toFixed(1)}s</span>
          </div>
        </div>
      </div>
      <div className="page-grid">
      <aside className="config-panel">
        <TelemetryCard kicker="Config" title="Race Setup">
          <RaceSelector />
          <TelemetrySlider label="Base Pace" min={60} max={120} step={0.1} value={basePace} onChange={setBasePace} unit="s" />
          <TelemetrySlider label="Pit Delta" min={10} max={40} step={0.1} value={pitDelta} onChange={setPitDelta} unit="s" />
          <TelemetrySlider label="Total Laps" min={30} max={80} step={1} value={totalLaps} onChange={setTotalLaps} />

          <div className="field">
            <span className="field-label">Stops</span>
            <div className="segmented">
              <button type="button" aria-pressed={stopCount === 1} className={stopCount === 1 ? "active" : ""} onClick={() => setStopCount(1)}>1-STOP</button>
              <button type="button" aria-pressed={stopCount === 2} className={stopCount === 2 ? "active" : ""} onClick={() => setStopCount(2)}>2-STOP</button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Compounds</span>
            <div className="compound-grid">
              <select className="telemetry-select" value={compounds[0]} onChange={(e) => setCompoundAt(0, e.target.value as typeof compounds[0])}>
                <option value="SOFT">SOFT</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
              <select className="telemetry-select" value={compounds[1]} onChange={(e) => setCompoundAt(1, e.target.value as typeof compounds[1])}>
                <option value="SOFT">SOFT</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
              {stopCount === 2 ? (
                <select className="telemetry-select" value={compounds[2]} onChange={(e) => setCompoundAt(2, e.target.value as typeof compounds[2])}>
                  <option value="SOFT">SOFT</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              ) : null}
            </div>
          </div>

          <div className="sim-actions">
            <button type="button" className="run-button" onClick={() => void compute()}>
              Run Strategy
            </button>
            <label className="toggle-auto">
              <input
                type="checkbox"
                checked={autoRun}
                onChange={(event) => setAutoRun(event.target.checked)}
              />
              Auto-run on change
            </label>
          </div>
        </TelemetryCard>
      </aside>

      <main className="output-panel">
        <TelemetryCard kicker="Output" title="Optimal Strategy">
          {isLoading ? <LoadingSkeleton /> : null}
          {!isLoading && result ? (
            <>
              <div className="kpi-hero">
                <div>
                  <div className="mono-label">Recommended pit lap</div>
                  <div className="kpi-main">{result.optimal.pit_laps.join(" / ")}</div>
                </div>
                <div>
                  <div className="mono-label">Delta vs no-stop</div>
                  <DeltaBadge delta={result.optimal.delta_vs_no_stop_s} />
                </div>
              </div>
              <div className="summary-row">
                <div>
                  <div className="mono-label">Strategy</div>
                  <StrategyBadge stops={stopCount} />
                </div>
                <div>
                  <div className="mono-label">Total race time</div>
                  <div className="big-value">{result.optimal.total_time_s.toFixed(1)}s</div>
                </div>
                <div>
                  <div className="mono-label">Best undercut lap</div>
                  <div className="big-value">{result.undercut_window.best_lap ?? "N/A"}</div>
                </div>
              </div>
              <StrategyTimeline stints={result.optimal.stints} pitLaps={result.optimal.pit_laps} totalLaps={totalLaps} />
            </>
          ) : null}
          {error ? <p className="error-text" role="status" aria-live="polite">{error}</p> : null}
        </TelemetryCard>

        <TelemetryCard kicker="Charts" title="Lap Time Degradation">
          <LapTimeChart data={compoundSeries} pitLaps={result?.optimal.pit_laps ?? []} />
        </TelemetryCard>

        <TelemetryCard kicker="Undercut" title="Undercut Window">
          {undercutPoints.length > 0 ? <UndercutChart points={undercutPoints} /> : <p className="muted">No undercut data returned.</p>}
        </TelemetryCard>
      </main>
    </div>
    </>
  );
}
