import { MCDistributionChart } from "../components/MCDistributionChart";
import { JobStatusBar } from "../components/JobStatusBar";
import { TelemetryCard } from "../components/TelemetryCard";
import { TelemetrySlider } from "../components/TelemetrySlider";
import { useMonteStore } from "../stores/useMonteStore";
import { formatDuration, formatPercent } from "../utils/format";

export function MonteCarloPage() {
  const {
    scProbability,
    iterations,
    totalLaps,
    run,
    setScProbability,
    setIterations,
    jobState,
    elapsedMs,
    jobId,
    result,
    error,
    logs,
  } = useMonteStore();

  const simulatedIterationProgress =
    jobState === "running" || jobState === "queued"
      ? Math.min(iterations, Math.floor((elapsedMs / 4000) * iterations))
      : iterations;
  const topStrategy = result?.distribution[0];
  const expectedSc = scProbability * totalLaps;

  return (
    <>
      <div className="page-grid single">
        <main className="output-panel">
          <TelemetryCard kicker="Monte Carlo" title="Safety Car Simulator">
            <div className="control-row">
              <TelemetrySlider
                label="SC probability"
                min={0}
                max={0.3}
                step={0.01}
                value={scProbability}
                onChange={setScProbability}
              />
              <TelemetrySlider
                label="Iterations"
                min={100}
                max={5000}
                step={100}
                value={iterations}
                onChange={setIterations}
              />
              <button
                type="button"
                className="run-button"
                onClick={() => void run()}
                disabled={jobState === "running" || jobState === "queued"}
                aria-busy={jobState === "running" || jobState === "queued"}
              >
                Run Simulation
              </button>
            </div>

            <div className="summary-row">
              <div>
                <div className="mono-label">Job state</div>
                <div className="big-value">{jobState.toUpperCase()}</div>
              </div>
              <div>
                <div className="mono-label">Elapsed</div>
                <div className="big-value">{formatDuration(elapsedMs)}</div>
              </div>
              <div>
                <div className="mono-label">Estimated iterations</div>
                <div className="big-value">{simulatedIterationProgress.toLocaleString()}</div>
              </div>
            </div>

            <div className="stat-grid">
              <div className="stat-card">
                <div className="mono-label">Top win %</div>
                <div className="stat-value">{topStrategy ? formatPercent(topStrategy.win_pct) : "--"}</div>
                <div className="stat-sub">{topStrategy?.strategy ?? "No result yet"}</div>
              </div>
              <div className="stat-card">
                <div className="mono-label">Runs</div>
                <div className="stat-value">{result?.n_iterations ?? iterations}</div>
                <div className="stat-sub">iterations</div>
              </div>
              <div className="stat-card">
                <div className="mono-label">Avg time</div>
                <div className="stat-value">{topStrategy ? `${topStrategy.avg_time_s.toFixed(1)}s` : "--"}</div>
                <div className="stat-sub">top strategy</div>
              </div>
              <div className="stat-card">
                <div className="mono-label">SC / race</div>
                <div className="stat-value">{expectedSc.toFixed(1)}</div>
                <div className="stat-sub">expected</div>
              </div>
            </div>

            {result ? <MCDistributionChart distribution={result.distribution} /> : null}
            {error ? <p className="error-text" role="status" aria-live="polite">{error}</p> : null}
          </TelemetryCard>

          <TelemetryCard kicker="Last Runs" title="Simulation Log">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Iterations</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No runs yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td>#{log.id}</td>
                      <td>{log.iterations.toLocaleString()}</td>
                      <td>{formatDuration(log.durationMs)}</td>
                      <td>{log.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {result ? (
              <p className="muted">
                Top strategy: {result.distribution[0]?.strategy} · {formatPercent(result.distribution[0]?.win_pct ?? 0)}
              </p>
            ) : null}
          </TelemetryCard>
        </main>
      </div>
      <JobStatusBar status={jobState} elapsedMs={elapsedMs} jobId={jobId} />
    </>
  );
}
