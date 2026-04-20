import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { strategyEngine } from "../services/strategyEngineClient.js";
import { env } from "../config/env.js";
import { cacheJson } from "../middleware/cache.js";

export const strategyRouter = Router();
const CACHE_VER = "v1";

const ComputeSchema = z.object({
  base_pace_s: z.number(),
  pit_delta_s: z.number(),
  total_laps: z.number().int(),
  stop_count: z.number().int(),
  compounds: z.array(z.object({ compound: z.string() })),
});

function hashBody(body: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

strategyRouter.post(
  "/compute",
  cacheJson(env.CACHE_TTL_S, (req) => {
    const includeScans = String(req.query.include_scans || "false") === "true";
    return `compute:${CACHE_VER}:${includeScans}:${hashBody(req.body)}`;
  }),
  async (req, res, next) => {
    try {
      const includeScans = String(req.query.include_scans || "false") === "true";
      const body = ComputeSchema.parse(req.body);

      const engineRes = await strategyEngine.post("/compute", body);
      const data: any = engineRes.data;

      if (!includeScans) {
        if (data?.all_1stop_times) data.all_1stop_times = null;
        if (data?.all_2stop_times) data.all_2stop_times = null;
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

strategyRouter.post("/pit-window", async (req, res, next) => {
  try {
    const engineRes = await strategyEngine.post("/pit-window", req.body);
    res.json(engineRes.data);
  } catch (err) {
    next(err);
  }
});

strategyRouter.post("/monte-carlo", async (req, res, next) => {
  try {
    const engineRes = await strategyEngine.post("/monte-carlo", req.body);
    res.json(engineRes.data);
  } catch (err) {
    next(err);
  }
});