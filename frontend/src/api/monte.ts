import { api } from "./client";
import type { MonteJobResult, MonteRequest } from "../types";

export async function enqueueMonte(payload: MonteRequest) {
  const { data } = await api.post<{ jobId: string | number }>("/api/monte/run", payload);
  return data;
}

export async function getMonteResult(jobId: string | number) {
  const { data } = await api.get<MonteJobResult>(`/api/monte/result/${jobId}`);
  return data;
}
