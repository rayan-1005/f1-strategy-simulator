import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  points: Array<{ lap: number; gain: number }>;
}

export function UndercutChart({ points }: Props) {
  return (
    <div className="chart-box" aria-label="Undercut gain by lap">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={points}>
          <XAxis dataKey="lap" stroke="#888" tick={{ fill: "#888", fontSize: 11 }} />
          <YAxis stroke="#888" tick={{ fill: "#888", fontSize: 11 }} />
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(2)}s`}
            contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)" }}
          />
          <ReferenceLine y={0} stroke="#444" />
          <Bar dataKey="gain">
            {points.map((entry) => (
              <Cell key={entry.lap} fill={entry.gain >= 0 ? "#3DDC97" : "#FF5959"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
