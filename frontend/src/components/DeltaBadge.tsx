interface Props {
  delta: number;
}

export function DeltaBadge({ delta }: Props) {
  const cls = delta <= 0 ? "positive" : "negative";
  const sign = delta > 0 ? "+" : "";
  return <span className={`delta-badge ${cls}`}>{sign}{delta.toFixed(2)}s</span>;
}
