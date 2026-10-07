import type { Request, Response } from "express";
import streakService from "../services/streakService.js";

/**
 * Record a daily login and return updated streak info.
 * POST /users/streak/checkin
 * Body: { tzOffsetMinutes?: number } — minutes east of UTC (e.g. Sydney 600/660).
 * The server decides the date; any client-sent todayDate is ignored.
 */
export async function recordStreakCheckin(req: Request, res: Response) {
  // @ts-ignore req.user is set by requireAuth (typed properly in T1.8)
  const userId = req.user?.userId as string | undefined;
  if (!userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { tzOffsetMinutes } = (req.body || {}) as { tzOffsetMinutes?: unknown };

  try {
    const result = await streakService.recordDailyLogin(userId, tzOffsetMinutes);
    res.json({
      currentStreak: result.streak.currentStreak,
      longestStreak: result.streak.longestStreak,
      lastLoginDate: result.streak.lastLoginDate,
      extended: result.extended,
      isNewStreak: result.isNewStreak,
    });
  } catch (e: any) {
    console.error("streakController.recordStreakCheckin failed", e?.name);
    res.status(500).json({ error: "server_error" });
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
