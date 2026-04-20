import { create } from "zustand";
import type { Compound, RacePreset } from "../types";
import { fetchRaces } from "../api/races";

const fallbackPresets: RacePreset[] = [
  {
    id: "bahrain-2023",
    label: "Bahrain 2023",
    round: 1,
    totalLaps: 57,
    basePace: 90,
    pitDelta: 22,
    defaultCompounds: ["SOFT", "MEDIUM", "HARD"],
  },
  {
    id: "jeddah-2023",
    label: "Saudi Arabia 2023",
    round: 2,
    totalLaps: 50,
    basePace: 88.5,
    pitDelta: 20.5,
    defaultCompounds: ["MEDIUM", "HARD", "SOFT"],
  },
  {
    id: "monza-2023",
    label: "Monza 2023",
    round: 14,
    totalLaps: 53,
    basePace: 81.2,
    pitDelta: 24.1,
    defaultCompounds: ["MEDIUM", "HARD", "SOFT"],
  },
];

const DEFAULT_PRESET = {
  totalLaps: 57,
  basePace: 90,
  pitDelta: 22,
  defaultCompounds: ["SOFT", "MEDIUM", "HARD"] as Compound[],
};

interface RaceState {
  presets: RacePreset[];
  selectedRaceId: string;
  isLoading: boolean;
  error: string | null;
  setRace: (id: string) => void;
  loadRaces: () => Promise<void>;
}

export const useRaceStore = create<RaceState>((set, get) => ({
  presets: fallbackPresets,
  selectedRaceId: fallbackPresets[0].id,
  isLoading: false,
  error: null,
  setRace: (id) => set({ selectedRaceId: id }),
  loadRaces: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const races = await fetchRaces();
      if (!races.length) {
        set({ isLoading: false });
        return;
      }

      const mapped: RacePreset[] = races.map((race) => ({
        id: race.raceId,
        label: `${race.raceName} ${race.season}`,
        round: race.round,
        totalLaps: race.totalLaps ?? DEFAULT_PRESET.totalLaps,
        basePace: race.basePace_s ?? DEFAULT_PRESET.basePace,
        pitDelta: race.pitDelta_s ?? DEFAULT_PRESET.pitDelta,
        defaultCompounds: DEFAULT_PRESET.defaultCompounds,
      }));

      const current = get().selectedRaceId;
      const nextSelected = mapped.find((preset) => preset.id === current)?.id ?? mapped[0].id;
      set({ presets: mapped, selectedRaceId: nextSelected, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: "Failed to load races." });
    }
  },
}));

export function getRacePresetById(id: string) {
  const { presets } = useRaceStore.getState();
  return presets.find((p) => p.id === id) ?? presets[0];
}
