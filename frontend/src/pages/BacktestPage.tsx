import { useEffect } from "react";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { RaceSelector } from "../components/RaceSelector";
import { TelemetryCard } from "../components/TelemetryCard";
import { useBacktestStore } from "../stores/useBacktestStore";
import { useRaceStore } from "../stores/useRaceStore";

export function BacktestPage() {
  const selectedRaceId = useRaceStore((s) => s.selectedRaceId);
  const { modelOptimalLap, modelStops, winnerLap, deltaSeconds, status, matchRate, averageLapError, rows, isLoading, error, loadBacktest } =
    useBacktestStore();

  useEffect(() => {
    if (!selectedRaceId) return;
    void loadBacktest(selectedRaceId);
  }, [selectedRaceId, loadBacktest]);

  return (
    <div className="page-grid single">
      <main className="output-panel">
        <TelemetryCard kicker="Backtest" title="Race Selection">
          <RaceSelector />
        </TelemetryCard>
        <TelemetryCard kicker="Backtest" title="Model vs Actual">
          {isLoading ? <LoadingSkeleton /> : null}
          {!isLoading ? (
            <>
              <div className="summary-row">
                <div>
                  <div className="mono-label">Model optimal</div>
                  <div className="big-value">{modelOptimalLap ? `Lap ${modelOptimalLap}` : "N/A"}</div>
                </div>
                <div>
                  <div className="mono-label">Winner stop</div>
                  <div className="big-value">{modelStops}-STOP</div>
                </div>
                <div>
                  <div className="mono-label">Winner lap</div>
                  <div className="big-value">{winnerLap ?? "N/A"}</div>
                </div>
                <div>
                  <div className="mono-label">Status</div>
                  <div className={`status-pill ${status.toLowerCase()}`}>{status}</div>
                </div>
              </div>
              <p className="muted">Delta vs winner: {deltaSeconds >= 0 ? "+" : ""}{deltaSeconds.toFixed(1)}s</p>
              <div className="summary-row">
                <div>
                  <div className="mono-label">Match rate</div>
                  <div className="big-value">{(matchRate * 100).toFixed(0)}%</div>
                </div>
                <div>
                  <div className="mono-label">Avg lap error</div>
                  <div className="big-value">{averageLapError.toFixed(1)}</div>
                </div>
                <div>
                  <div className="mono-label">Races sampled</div>
                  <div className="big-value">{rows.length}</div>
                </div>
              </div>
            </>
          ) : null}
          {error ? <p className="error-text" role="status" aria-live="polite">{error}</p> : null}
        </TelemetryCard>

        <TelemetryCard kicker="Reference" title="Actual Strategy Table">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Stops</th>
                <th>Pit Laps</th>
                <th>Total Time</th>
                <th>Delta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.driver} className={`row-${row.status.toLowerCase()}`}>
                  <td>{row.driver}</td>
                  <td>{row.stopCount}</td>
                  <td>{row.pitLaps}</td>
                  <td>{row.totalTime}</td>
                  <td>{row.deltaSeconds >= 0 ? "+" : ""}{row.deltaSeconds.toFixed(1)}s</td>
                  <td><span className={`status-pill ${row.status.toLowerCase()}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TelemetryCard>
      </main>
    </div>
  );
}
