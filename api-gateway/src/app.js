import express from "express";
import cors from "cors";
import { rateLimit } from "./middleware/rateLimit.js";
import { healthRouter } from "./routes/health.js";
import { backtestRouter } from "./routes/backtest.js";
import { racesRouter } from "./routes/races.js";
import { strategyRouter } from "./routes/strategy.js";
import { monteRouter } from "./routes/monte.js";
import { errorMiddleware } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use(rateLimit());

  app.use("/api/health", healthRouter);
  app.use("/api/backtest", backtestRouter);
  app.use("/api/races", racesRouter);
  app.use("/api/strategy", strategyRouter);
  app.use("/api/monte", monteRouter);

  app.use(errorMiddleware);
  return app;
}
