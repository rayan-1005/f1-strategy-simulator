export type Compound = "SOFT" | "MEDIUM" | "HARD";

export interface CompoundConfig {
  compound: Compound;
}

export interface Stint {
  compound: Compound;
  start_lap: number;
  end_lap: number;
  laps: number;
}

export interface OptimalStop {
  pit_laps: number[];
  stints: Stint[];
  total_time_s: number;
  delta_vs_no_stop_s: number;
}

export interface UndercutWindow {
  viable_laps: number[];
  gains_s: Record<number, number>;
  best_lap: number | null;
  best_gain_s: number | null;
}

export interface ComputeResponse {
  optimal: OptimalStop;
  undercut_window: UndercutWindow;
  all_1stop_times: Record<number, number> | null;
  all_2stop_times: Record<string, number> | null;
}

export interface ComputeRequest {
  base_pace_s: number;
  pit_delta_s: number;
  total_laps: number;
  stop_count: 1 | 2;
  compounds: CompoundConfig[];
}

export interface MonteRequest {
  base_pace_s: number;
  pit_delta_s: number;
  total_laps: number;
  sc_probability: number;
  n_iterations: number;
  compounds: CompoundConfig[];
}

export interface MonteDistribution {
  strategy: string;
  pit_laps: number[];
  win_pct: number;
  avg_time_s: number;
  p10_time_s: number;
  p90_time_s: number;
}

export interface MonteResponse {
  n_iterations: number;
  sc_probability: number;
  distribution: MonteDistribution[];
  baseline_no_sc_optimal_lap: number;
}

export interface MonteJobResult {
  jobId: string | number;
  status: string;
  result?: MonteResponse;
  error?: string;
}

export interface RacePreset {
  id: string;
  label: string;
  round: number;
  totalLaps: number;
  basePace: number;
  pitDelta: number;
  defaultCompounds: Compound[];
}

export interface BacktestRow {
  driver: string;
  stopCount: number;
  pitLaps: string;
  totalTime: string;
  deltaSeconds: number;
  status: "MATCH" | "NEAR" | "MISS";
}

export interface BacktestResponse {
  raceId: string;
  raceName: string;
  season: number;
  round: number;
  modelOptimalLap: number | null;
  modelStops: 1 | 2;
  winnerLap: number | null;
  deltaSeconds: number;
  status: "MATCH" | "NEAR" | "MISS";
  matchRate: number;
  averageLapError: number;
  rows: BacktestRow[];
}
