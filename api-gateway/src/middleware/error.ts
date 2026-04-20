import type { NextFunction, Request, Response } from "express";
import axios from "axios";
import { ZodError } from "zod";

export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "validation_error",
      details: err.issues,
    });
  }

  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 502;
    return res.status(status).json({
      error: "upstream_error",
      upstream: {
        status,
        data: err.response?.data,
      },
    });
  }

  const status = Number(err?.status || 500);
  const message = err?.message || "Internal Server Error";
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}