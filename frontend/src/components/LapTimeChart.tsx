import { Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ lap: number; soft: number; medium: number; hard: number }>;
  pitLaps: number[];
}

export function LapTimeChart({ data, pitLaps }: Props) {
  return (
    <div className="chart-box" aria-label="Lap time degradation curves">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <XAxis dataKey="lap" stroke="#888" tick={{ fill: "#888", fontSize: 11 }} />
          <YAxis stroke="#888" tick={{ fill: "#888", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)" }}
            labelStyle={{ color: "#F5F5F5" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#888" }} />
          <Line type="monotone" dataKey="soft" name="Soft" stroke="#E8002D" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="medium" name="Medium" stroke="#F0D75C" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="hard" name="Hard" stroke="#F5F5F5" dot={false} strokeWidth={2} />
          {pitLaps.map((lap) => (
            <ReferenceLine key={lap} x={lap} stroke="#E8002D" strokeDasharray="4 4" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
