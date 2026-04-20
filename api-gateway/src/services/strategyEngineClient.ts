import axios from "axios";
import { env } from "../config/env.js";

export const strategyEngine = axios.create({
  baseURL: env.STRATEGY_ENGINE_URL,
  timeout: 30_000,
});