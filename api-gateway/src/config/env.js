import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  STRATEGY_ENGINE_URL: z.string().default("http://127.0.0.1:8000"),
  MONGO_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CACHE_TTL_S: z.coerce.number().default(60),
  RATE_LIMIT_WINDOW_S: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(60),
});

export const env = EnvSchema.parse(process.env);
