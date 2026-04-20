import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { strategyEngine } from "../services/strategyEngineClient.js";

export const backtestRouter = Router();

const QuerySchema = z.object({
  raceId: z.string().min(1),
});

type LapDoc = {
  driver: string;
  lapNumber: number;
  lapTime_s: number;
  stint: number | null;
};

type DriverRow = {
  driver: string;
  pitLaps: number[];
  stopCount: number;
  totalTime_s: number;
  maxLap: number;
};

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midVal = sorted[mid]!;
  if (sorted.length % 2 === 0) {
    const prevVal = sorted[mid - 1]!;
    return (prevVal + midVal) / 2;
  }
  return midVal;
}

function formatRaceTime(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function classify(diff: number | null) {
  if (diff === null || Number.isNaN(diff)) return "MISS";
  if (diff === 0) return "MATCH";
  if (diff <= 2) return "NEAR";
  return "MISS";
}

backtestRouter.get("/", async (req, res, next) => {
  try {
    const { raceId } = QuerySchema.parse(req.query);
    const db = mongoose.connection.db;

    if (!db) {
      return res.status(503).json({ error: "mongo not connected" });
    }

    const race = await db.collection("races").findOne({ raceId });
    if (!race) {
      return res.status(404).json({ error: "race not found" });
    }

    const laps = (await db
      .collection("lap_data")
      .find({ raceId, lapTime_s: { $ne: null } })
      .project({ driver: 1, lapNumber: 1, lapTime_s: 1, stint: 1 })
      .toArray()) as LapDoc[];

    if (!laps.length) {
      return res.status(404).json({ error: "lap data not found for race" });
    }

    const byDriver = new Map<string, LapDoc[]>();
    for (const lap of laps) {
      if (!lap.driver || lap.lapNumber == null || lap.lapTime_s == null) continue;
      const list = byDriver.get(lap.driver) ?? [];
      list.push({
        driver: lap.driver,
        lapNumber: Number(lap.lapNumber),
        lapTime_s: Number(lap.lapTime_s),
        stint: lap.stint == null ? null : Number(lap.stint),
      });
      byDriver.set(lap.driver, list);
    }

    const driverRows: DriverRow[] = [];
    const nonPitLapTimes: number[] = [];
    const pitLapTimes: number[] = [];
    let totalLaps = 0;

    for (const [driver, driverLaps] of byDriver.entries()) {
      driverLaps.sort((a, b) => a.lapNumber - b.lapNumber);

      const pitLaps: number[] = [];
      let prevStint: number | null = null;
      for (const lap of driverLaps) {
        if (lap.stint != null && prevStint != null && lap.stint > prevStint) {
          pitLaps.push(lap.lapNumber);
        }
        prevStint = lap.stint ?? prevStint;
      }

      const pitLapSet = new Set(pitLaps);
      let totalTime_s = 0;
      let maxLap = 0;

      for (const lap of driverLaps) {
        if (!Number.isFinite(lap.lapTime_s)) continue;
        totalTime_s += lap.lapTime_s;
        maxLap = Math.max(maxLap, lap.lapNumber);
        if (pitLapSet.has(lap.lapNumber)) {
          pitLapTimes.push(lap.lapTime_s);
        } else {
          nonPitLapTimes.push(lap.lapTime_s);
        }
      }

      totalLaps = Math.max(totalLaps, maxLap);
      driverRows.push({
        driver,
        pitLaps,
        stopCount: pitLaps.length,
        totalTime_s,
        maxLap,
      });
    }

    if (!driverRows.length || totalLaps === 0) {
      return res.status(404).json({ error: "lap data not usable for backtest" });
    }

    const finishers = driverRows.filter((row) => row.maxLap === totalLaps);
    const ranked = (finishers.length ? finishers : driverRows).sort((a, b) => a.totalTime_s - b.totalTime_s);
    if (!ranked.length) {
      return res.status(404).json({ error: "no ranked drivers found" });
    }
    const winner = ranked[0]!;

    const basePace = median(nonPitLapTimes) ?? median(laps.map((lap) => lap.lapTime_s)) ?? 90;
    const pitDeltaRaw =
      pitLapTimes.length && nonPitLapTimes.length
        ? (median(pitLapTimes) ?? 0) - (median(nonPitLapTimes) ?? 0)
        : null;
    const pitDelta = pitDeltaRaw && Number.isFinite(pitDeltaRaw) && pitDeltaRaw > 0 ? pitDeltaRaw : 22;

    const [oneStop, twoStop] = await Promise.all([
      strategyEngine.post("/compute", {
        base_pace_s: basePace,
        pit_delta_s: pitDelta,
        total_laps: totalLaps,
        stop_count: 1,
        compounds: [{ compound: "SOFT" }, { compound: "MEDIUM" }],
      }),
      strategyEngine.post("/compute", {
        base_pace_s: basePace,
        pit_delta_s: pitDelta,
        total_laps: totalLaps,
        stop_count: 2,
        compounds: [{ compound: "SOFT" }, { compound: "MEDIUM" }, { compound: "HARD" }],
      }),
    ]);

    const bestModel = oneStop.data.optimal.total_time_s <= twoStop.data.optimal.total_time_s ? oneStop.data : twoStop.data;
    const modelStops = bestModel.optimal.pit_laps.length > 1 ? 2 : 1;
    const modelOptimalLap = bestModel.optimal.pit_laps[0] ?? null;
    const modelTotalTime = bestModel.optimal.total_time_s;

    const winnerLap = winner.pitLaps[0] ?? null;
    const overallDiff = modelOptimalLap != null && winnerLap != null ? Math.abs(modelOptimalLap - winnerLap) : null;
    const status = classify(overallDiff);

    let matchCount = 0;
    let errorSum = 0;
    let errorCount = 0;

    const rows = ranked.map((row) => {
      const driverLap = row.pitLaps[0] ?? null;
      const diff = modelOptimalLap != null && driverLap != null ? Math.abs(modelOptimalLap - driverLap) : null;
      const rowStatus = classify(diff);
      if (diff != null) {
        errorSum += diff;
        errorCount += 1;
        if (diff <= 2) matchCount += 1;
      }
      return {
        driver: row.driver,
        stopCount: row.stopCount,
        pitLaps: row.pitLaps.length ? row.pitLaps.join(",") : "—",
        totalTime: formatRaceTime(row.totalTime_s),
        deltaSeconds: row.totalTime_s - winner.totalTime_s,
        status: rowStatus,
      };
    });

    const matchRate = errorCount ? matchCount / errorCount : 0;
    const averageLapError = errorCount ? errorSum / errorCount : 0;

    res.json({
      raceId,
      raceName: race.raceName,
      season: race.season,
      round: race.round,
      modelOptimalLap,
      modelStops,
      winnerLap,
      deltaSeconds: modelTotalTime - winner.totalTime_s,
      status,
      matchRate,
      averageLapError,
      rows,
    });
  } catch (err) {
    next(err);
  }
});
