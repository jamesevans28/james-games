import type { NextFunction, Request, Response } from "express";
import { log } from "./log.js";

/** Status for an error: an explicit 4xx status, a known code, or 500. */
export function statusFor(err: unknown): number {
  const e = (err && typeof err === "object" ? err : {}) as {
    status?: unknown; statusCode?: unknown; code?: unknown; type?: unknown;
  };
  const explicit = Number(e.status ?? e.statusCode);
  if (Number.isInteger(explicit) && explicit >= 400 && explicit < 500) return explicit;
  if (e.code === "CONFLICT") return 409;
  if (e.type === "entity.parse.failed" || e.type === "entity.too.large") return 400;
  return 500;
}

/** Public error code for a response. Server errors never reveal their message. */
export function publicErrorFor(err: unknown, status: number): string {
  if (status >= 500) return "server_error";
  const e = (err && typeof err === "object" ? err : {}) as { code?: unknown; type?: unknown };
  if (e.type === "entity.parse.failed") return "invalid_json";
  if (e.type === "entity.too.large") return "payload_too_large";
  return typeof e.code === "string" ? e.code.toLowerCase() : "bad_request";
}

/** For catch blocks: log the error without personal data and reply 500 server_error. */
export function sendServerError(res: Response, event: string, err: unknown) {
  log.error(event, undefined, err);
  if (!res.headersSent) res.status(500).json({ error: "server_error" });
}

/** Final Express error middleware: maps errors to a status and a safe public code. */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  const status = statusFor(err);
  if (status >= 500) log.error("unhandled_error", undefined, err);
  else log.warn("request_error", { status }, err);
  res.status(status).json({ error: publicErrorFor(err, status) });
}
