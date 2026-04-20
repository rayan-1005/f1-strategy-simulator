import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonteDistribution } from "../types";
import { formatPercent } from "../utils/format";

interface Props {
  distribution: MonteDistribution[];
}

export function MCDistributionChart({ distribution }: Props) {
  return (
    <div className="chart-box" aria-label="Monte Carlo strategy distribution">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={distribution} layout="vertical">
          <XAxis type="number" stroke="#888" tickFormatter={(value) => `${Number(value * 100).toFixed(0)}%`} />
          <YAxis type="category" dataKey="strategy" stroke="#888" width={180} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => formatPercent(Number(value))}
            contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.12)" }}
          />
          <Bar dataKey="win_pct" fill="#E8002D" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
