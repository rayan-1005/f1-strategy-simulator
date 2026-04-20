import { useEffect } from "react";
import { useRaceStore } from "../stores/useRaceStore";

export function RaceSelector() {
  const presets = useRaceStore((s) => s.presets);
  const selectedRaceId = useRaceStore((s) => s.selectedRaceId);
  const setRace = useRaceStore((s) => s.setRace);
  const isLoading = useRaceStore((s) => s.isLoading);
  const error = useRaceStore((s) => s.error);
  const loadRaces = useRaceStore((s) => s.loadRaces);

  useEffect(() => {
    void loadRaces();
  }, [loadRaces]);

  return (
    <label className="field">
      <span className="field-label">Race Selector</span>
      <select
        className="telemetry-select"
        value={selectedRaceId}
        onChange={(event) => setRace(event.target.value)}
      >
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      {isLoading ? <span className="muted">Loading races...</span> : null}
      {error ? (
        <span className="error-text" role="status" aria-live="polite">
          {error}
        </span>
      ) : null}
    </label>
  );
}
