import { api } from "./client";
import type { BacktestResponse } from "../types";

export async function fetchBacktest(raceId: string) {
  const { data } = await api.get<BacktestResponse>("/api/backtest", {
    params: { raceId },
  });
  return data;
}
