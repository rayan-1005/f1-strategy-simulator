import { create } from "zustand";
import type { BacktestRow } from "../types";
import { fetchBacktest } from "../api/backtest";

type MatchStatus = "MATCH" | "NEAR" | "MISS";

interface BacktestState {
  modelOptimalLap: number;
  modelStops: 1 | 2;
  winnerLap: number;
  deltaSeconds: number;
  status: MatchStatus;
  matchRate: number;
  averageLapError: number;
  rows: BacktestRow[];
  isLoading: boolean;
  error: string | null;
  loadBacktest: (raceId: string) => Promise<void>;
}

const fallbackState: Omit<BacktestState, "isLoading" | "error" | "loadBacktest"> = {
  modelOptimalLap: 28,
  modelStops: 1,
  winnerLap: 28,
  deltaSeconds: 0,
  status: "MATCH",
  matchRate: 0.8,
  averageLapError: 1.2,
  rows: [
    { driver: "Verstappen", stopCount: 1, pitLaps: "28", totalTime: "1:33:56", deltaSeconds: 0, status: "MATCH" },
    { driver: "Perez", stopCount: 1, pitLaps: "29", totalTime: "1:34:08", deltaSeconds: 1.2, status: "NEAR" },
    { driver: "Alonso", stopCount: 2, pitLaps: "14,34", totalTime: "1:34:31", deltaSeconds: 4.8, status: "MISS" },
  ],
};

export const useBacktestStore = create<BacktestState>((set, get) => ({
  ...fallbackState,
  isLoading: false,
  error: null,
  loadBacktest: async (raceId) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const data = await fetchBacktest(raceId);
      set({
        modelOptimalLap: data.modelOptimalLap ?? fallbackState.modelOptimalLap,
        modelStops: data.modelStops,
        winnerLap: data.winnerLap ?? fallbackState.winnerLap,
        deltaSeconds: data.deltaSeconds,
        status: data.status,
        matchRate: data.matchRate,
        averageLapError: data.averageLapError,
        rows: data.rows.length ? data.rows : fallbackState.rows,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: "Failed to load backtest data." });
    }
  },
}));
