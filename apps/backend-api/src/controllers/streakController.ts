import type { Request, Response } from "express";
import streakService from "../services/streakService.js";

/**
 * Record a daily login and return updated streak info.
 * POST /users/streak/checkin
 * Body: { todayDate: string } - YYYY-MM-DD in user's timezone
 */
export async function recordStreakCheckin(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { todayDate } = (req.body || {}) as { todayDate?: string };

  // Validate date format
  if (!todayDate || !/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) {
    return res.status(400).json({ error: "todayDate must be in YYYY-MM-DD format" });
  }

  try {
    const result = await streakService.recordDailyLogin(userId, todayDate);
    res.json({
      currentStreak: result.streak.currentStreak,
      longestStreak: result.streak.longestStreak,
      lastLoginDate: result.streak.lastLoginDate,
      extended: result.extended,
      isNewStreak: result.isNewStreak,
    });
  } catch (e: any) {
    console.error("streakController.recordStreakCheckin error:", e);
    res.status(500).json({ error: e?.message || "Failed to record streak" });
  }
}

/**
 * Get current streak data for the authenticated user.
 * GET /users/streak
 */
export async function getStreak(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const streak = await streakService.getStreakData(userId);
    res.json({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastLoginDate: streak.lastLoginDate,
    });
  } catch (e: any) {
    console.error("streakController.getStreak error:", e);
    res.status(500).json({ error: e?.message || "Failed to get streak" });
  }
}
