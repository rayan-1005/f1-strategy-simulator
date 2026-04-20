import { Queue } from "bullmq";
import { redis } from "../services/redis.js";

export const monteQueue = new Queue("monte-carlo", {
  connection: redis as any,
});