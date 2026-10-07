import type { Request, Response } from "express";
import { getDashboardMetrics } from "../services/adminMetricsService.js";
import { sendServerError } from "../lib/http.js";

export async function dashboard(req: Request, res: Response) {
  try {
    const metrics = await getDashboardMetrics();
    res.json(metrics);
  } catch (err: any) {
    sendServerError(res, "admin_dashboard_metrics_failed", err);
  }
}
