import type { NextFunction, Request, Response } from "express";
import { redis } from "../services/redis.js";
import { env } from "../config/env.js";

export function rateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || "unknown";
      const windowS = env.RATE_LIMIT_WINDOW_S;
      const key = `rl:${ip}:${Math.floor(Date.now() / (windowS * 1000))}`;

      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, windowS);

      if (n > env.RATE_LIMIT_MAX) {
        return res.status(429).json({ error: "rate limit exceeded" });
      }

      next();
    } catch (e) {
      // If Redis is down, don't hard-fail your API
      next();
    }
  };
}