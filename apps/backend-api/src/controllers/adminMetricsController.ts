import type { Request, Response } from "express";
import { getDashboardMetrics } from "../services/adminMetricsService.js";
import { sendServerError } from "../lib/http.js";

export async function dashboard(_req: Request, res: Response) {
  try {
    res.json(await getDashboardMetrics());
  } catch (err) {
    sendServerError(res, "admin_dashboard_metrics_failed", err);
  }
}
