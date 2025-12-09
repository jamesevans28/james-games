import type { Request, Response } from "express";
import { getDashboardMetrics } from "../services/adminMetricsService.js";

export async function dashboard(req: Request, res: Response) {
  try {
    const metrics = await getDashboardMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed_to_get_dashboard_metrics" });
  }
}
