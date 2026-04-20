interface Props {
  stops: 1 | 2;
}

export function StrategyBadge({ stops }: Props) {
  return <span className={`strategy-badge ${stops === 1 ? "one" : "two"}`}>{stops}-STOP</span>;
}
