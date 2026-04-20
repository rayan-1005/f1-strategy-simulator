import { Router } from "express";
import { redis } from "../services/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let redisOk = false;
  try {
    redisOk = (await redis.ping()) === "PONG";
  } catch {}

  res.json({
    ok: true,
    service: "api-gateway",
    redis: redisOk ? "ok" : "down",
  });
});