import type { Stint } from "../types";

interface Props {
  stints: Stint[];
  totalLaps: number;
  pitLaps: number[];
}

export function StrategyTimeline({ stints, totalLaps, pitLaps }: Props) {
  return (
    <div className="timeline-strip" aria-label="Strategy timeline">
      {stints.map((stint) => {
        const width = (stint.laps / totalLaps) * 100;
        return (
          <div key={`${stint.compound}-${stint.start_lap}`} className={`stint ${stint.compound.toLowerCase()}`} style={{ width: `${width}%` }}>
            {stint.compound}
          </div>
        );
      })}
      {pitLaps.map((pitLap) => (
        <span key={pitLap} className="pit-marker" style={{ left: `${(pitLap / totalLaps) * 100}%` }} />
      ))}
    </div>
  );
}
