import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";

export const racesRouter = Router();

const QuerySchema = z.object({
  season: z.coerce.number().int().optional(),
});

racesRouter.get("/", async (req, res, next) => {
  try {
    const { season } = QuerySchema.parse(req.query);
    const db = mongoose.connection.db;

    if (!db) {
      return res.status(503).json({ error: "mongo not connected" });
    }

    const query = season ? { season } : {};
    const races = await db.collection("races").find(query).sort({ season: 1, round: 1 }).toArray();

    const statsPipeline = [
      { $match: season ? { season } : {} },
      { $match: { lapTime_s: { $ne: null } } },
      {
        $group: {
          _id: "$raceId",
          totalLaps: { $max: "$lapNumber" },
          avgLapTime: { $avg: "$lapTime_s" },
        },
      },
    ];

    const lapStats = await db.collection("lap_data").aggregate(statsPipeline).toArray();
    const statsMap = new Map(lapStats.map((stat) => [stat._id, stat]));

    const response = races.map((race) => {
      const stats = statsMap.get(race.raceId);
      return {
        raceId: race.raceId,
        season: race.season,
        round: race.round,
        raceName: race.raceName,
        officialName: race.officialName ?? null,
        eventDate: race.eventDate ?? null,
        eventFormat: race.eventFormat ?? null,
        location: race.location ?? null,
        country: race.country ?? null,
        totalLaps: stats?.totalLaps ?? null,
        basePace_s: stats?.avgLapTime ?? null,
        pitDelta_s: null,
      };
    });

    res.json(response);
  } catch (err) {
    next(err);
  }
});
