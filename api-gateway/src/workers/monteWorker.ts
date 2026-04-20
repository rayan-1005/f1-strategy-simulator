import { Worker } from "bullmq";
import { redis } from "../services/redis.js";
import { strategyEngine } from "../services/strategyEngineClient.js";
import "../config/env.js";
import { log } from "../utils/log.js";

log.info("monteWorker", "starting...");

const worker = new Worker(
  "monte-carlo",
  async (job) => {
    log.info("monteWorker", `job ${job.id} start`);
    const engineRes = await strategyEngine.post("/monte-carlo", job.data, {
      timeout: 60_000,
    });
    log.ok("monteWorker", `job ${job.id} done`);
    return engineRes.data;
  },
  { connection: redis as any },
);

worker.on("failed", (job, err) =>
  log.error("monteWorker", `job ${job?.id} failed`, err),
);
worker.on("completed", (job) =>
  log.ok("monteWorker", `job ${job.id} completed`),
);
worker.on("error", (err) => log.error("monteWorker", "worker error", err));

log.ok("monteWorker", "started");
