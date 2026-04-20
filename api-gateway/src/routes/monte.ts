import { Router } from "express";
import { z } from "zod";
import { monteQueue } from "../queue/monteQueue.js";
import { QueueEvents } from "bullmq";
import { redis } from "../services/redis.js";

export const monteRouter = Router();
const events = new QueueEvents("monte-carlo", { connection: redis as any });

const MonteRunSchema = z.object({
  base_pace_s: z.number(),
  pit_delta_s: z.number(),
  total_laps: z.number().int().positive(),
  sc_probability: z.number().min(0).max(1),
  n_iterations: z.number().int().min(100),
  compounds: z.array(z.object({ compound: z.string() })).min(1),
});

monteRouter.post("/run", async (req, res, next) => {
  try {
    const body = MonteRunSchema.parse(req.body);

    const job = await monteQueue.add("run", body, {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
      attempts: 1,
    });

    res.json({ jobId: job.id });
  } catch (e) {
    next(e);
  }
});

monteRouter.get("/result/:jobId", async (req, res, next) => {
  try {
    const job = await monteQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: "job not found" });

    const state = await job.getState();
    const result = state === "completed" ? job.returnvalue : undefined;
    const failedReason = state === "failed" ? job.failedReason : undefined;

    res.json({ jobId: job.id, status: state, result, error: failedReason });
  } catch (e) {
    next(e);
  }
});

events.on("error", (e) => console.error("[monteQueue events]", e));