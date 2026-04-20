import { api } from "./client";

export interface RaceApi {
  raceId: string;
  season: number;
  round: number;
  raceName: string;
  officialName?: string | null;
  eventDate?: string | null;
  eventFormat?: string | null;
  location?: string | null;
  country?: string | null;
  totalLaps?: number | null;
  basePace_s?: number | null;
  pitDelta_s?: number | null;
}

export async function fetchRaces() {
  const { data } = await api.get<RaceApi[]>("/api/races");
  return data ?? [];
}
