interface Props {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
}

export function TelemetrySlider({ label, min, max, step, value, onChange, unit }: Props) {
  return (
    <label className="field">
      <span className="field-label">
        {label} <strong>{value.toFixed(step >= 1 ? 0 : 2)}{unit ?? ""}</strong>
      </span>
      <input
        className="telemetry-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
