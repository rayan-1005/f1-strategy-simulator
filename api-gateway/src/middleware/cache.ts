import type { NextFunction, Request, Response } from "express";
import { redis } from "../services/redis.js";

export function cacheJson(ttlSeconds: number, keyFn: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyFn(req);
      const hit = await redis.get(key);
      if (hit) {
        res.setHeader("X-Cache", "HIT");
        return res.json(JSON.parse(hit));
      }

      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        // fire-and-forget
        redis.setex(key, ttlSeconds, JSON.stringify(body)).catch(() => {});
        res.setHeader("X-Cache", "MISS");
        return originalJson(body);
      };

      next();
    } catch {
      next();
    }
  };
}