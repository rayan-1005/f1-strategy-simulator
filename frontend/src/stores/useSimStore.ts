import { create } from "zustand";
import { computeStrategy } from "../api/strategy";
import type { Compound, ComputeResponse } from "../types";

interface SimState {
  basePace: number;
  pitDelta: number;
  totalLaps: number;
  stopCount: 1 | 2;
  compounds: [Compound, Compound, Compound];
  isLoading: boolean;
  error: string | null;
  result: ComputeResponse | null;
  setBasePace: (value: number) => void;
  setPitDelta: (value: number) => void;
  setTotalLaps: (value: number) => void;
  setStopCount: (value: 1 | 2) => void;
  setCompoundAt: (index: 0 | 1 | 2, value: Compound) => void;
  hydrateFromRace: (basePace: number, pitDelta: number, totalLaps: number, compounds: [Compound, Compound, Compound]) => void;
  compute: () => Promise<void>;
}

export const useSimStore = create<SimState>((set, get) => ({
  basePace: 90,
  pitDelta: 22,
  totalLaps: 57,
  stopCount: 1,
  compounds: ["MEDIUM", "HARD", "SOFT"],
  isLoading: false,
  error: null,
  result: null,
  setBasePace: (value) => set({ basePace: value }),
  setPitDelta: (value) => set({ pitDelta: value }),
  setTotalLaps: (value) => set({ totalLaps: value }),
  setStopCount: (value) => set({ stopCount: value }),
  setCompoundAt: (index, value) =>
    set((state) => {
      const next = [...state.compounds] as [Compound, Compound, Compound];
      next[index] = value;
      return { compounds: next };
    }),
  hydrateFromRace: (basePace, pitDelta, totalLaps, compounds) =>
    set({ basePace, pitDelta, totalLaps, compounds, result: null, error: null }),
  compute: async () => {
    const state = get();
    set({ isLoading: true, error: null });
    try {
      const activeCompounds =
        state.stopCount === 1
          ? [{ compound: state.compounds[0] }, { compound: state.compounds[1] }]
          : [{ compound: state.compounds[0] }, { compound: state.compounds[1] }, { compound: state.compounds[2] }];
      const result = await computeStrategy({
        base_pace_s: state.basePace,
        pit_delta_s: state.pitDelta,
        total_laps: state.totalLaps,
        stop_count: state.stopCount,
        compounds: activeCompounds,
      });
      set({ result, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to compute strategy";
      set({ error: message, isLoading: false });
    }
  },
}));
