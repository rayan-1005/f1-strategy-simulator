import { create } from "zustand";
import { enqueueMonte, getMonteResult } from "../api/monte";
import type { Compound, MonteResponse } from "../types";

type JobState = "idle" | "queued" | "running" | "completed" | "failed";

interface JobLog {
  id: string;
  iterations: number;
  durationMs: number;
  status: JobState;
}

interface MonteState {
  scProbability: number;
  iterations: number;
  basePace: number;
  pitDelta: number;
  totalLaps: number;
  compounds: [Compound, Compound, Compound];
  jobId: string | number | null;
  jobState: JobState;
  startedAt: number | null;
  elapsedMs: number;
  result: MonteResponse | null;
  error: string | null;
  logs: JobLog[];
  setScProbability: (value: number) => void;
  setIterations: (value: number) => void;
  run: () => Promise<void>;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

function normalizeJobState(raw: string): JobState {
  if (raw === "completed") return "completed";
  if (raw === "failed") return "failed";
  if (raw === "active") return "running";
  if (raw === "waiting" || raw === "waiting-children" || raw === "delayed") return "queued";
  return "running";
}

export const useMonteStore = create<MonteState>((set, get) => ({
  scProbability: 0.05,
  iterations: 1000,
  basePace: 90,
  pitDelta: 22,
  totalLaps: 57,
  compounds: ["MEDIUM", "HARD", "SOFT"],
  jobId: null,
  jobState: "idle",
  startedAt: null,
  elapsedMs: 0,
  result: null,
  error: null,
  logs: [],
  setScProbability: (value) => set({ scProbability: value }),
  setIterations: (value) => set({ iterations: value }),
  run: async () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({
      jobState: "queued",
      result: null,
      error: null,
      elapsedMs: 0,
    });

    const startedAt = Date.now();
    set({ startedAt });

    try {
      const state = get();
      const enqueue = await enqueueMonte({
        base_pace_s: state.basePace,
        pit_delta_s: state.pitDelta,
        total_laps: state.totalLaps,
        sc_probability: state.scProbability,
        n_iterations: state.iterations,
        compounds: [
          { compound: state.compounds[0] },
          { compound: state.compounds[1] },
          { compound: state.compounds[2] },
        ],
      });

      set({ jobId: enqueue.jobId, jobState: "running" });

      pollTimer = setInterval(async () => {
        try {
          const nextState = get();
          if (!nextState.jobId) return;

          set({ elapsedMs: Date.now() - startedAt });
          const response = await getMonteResult(nextState.jobId);
          const mapped = normalizeJobState(response.status);
          set({ jobState: mapped });

          if (mapped === "completed") {
            if (pollTimer) {
              clearInterval(pollTimer);
              pollTimer = null;
            }
            const log: JobLog = {
              id: String(response.jobId),
              iterations: get().iterations,
              durationMs: Date.now() - startedAt,
              status: "completed",
            };
            set((s) => ({
              result: response.result ?? null,
              logs: [log, ...s.logs].slice(0, 5),
            }));
          }

          if (mapped === "failed") {
            if (pollTimer) {
              clearInterval(pollTimer);
              pollTimer = null;
            }
            const log: JobLog = {
              id: String(response.jobId),
              iterations: get().iterations,
              durationMs: Date.now() - startedAt,
              status: "failed",
            };
            set((s) => ({
              error: response.error ?? "Monte Carlo job failed",
              logs: [log, ...s.logs].slice(0, 5),
            }));
          }
        } catch (error: unknown) {
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          const message = error instanceof Error ? error.message : "Polling failed";
          set({ error: message, jobState: "failed" });
        }
      }, 1000);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to enqueue Monte Carlo";
      set({ error: message, jobState: "failed" });
    }
  },
}));
