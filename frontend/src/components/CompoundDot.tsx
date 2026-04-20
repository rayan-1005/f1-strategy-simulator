import type { Compound } from "../types";

interface Props {
  compound: Compound;
}

const labels: Record<Compound, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
};

export function CompoundDot({ compound }: Props) {
  return <span className={`compound-dot ${compound.toLowerCase()}`}>{labels[compound]}</span>;
}
