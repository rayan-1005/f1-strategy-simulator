import { api } from "./client";
import type { ComputeRequest, ComputeResponse, MonteRequest, MonteResponse } from "../types";

export async function computeStrategy(payload: ComputeRequest, includeScans = true) {
  const { data } = await api.post<ComputeResponse>("/api/strategy/compute", payload, {
    params: { include_scans: includeScans },
  });
  return data;
}

export async function runMonteSync(payload: MonteRequest) {
  const { data } = await api.post<MonteResponse>("/api/strategy/monte-carlo", payload);
  return data;
}
