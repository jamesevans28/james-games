import type { Request, Response } from "express";
import { listUsers, getAdminUser, updateAdminUser } from "../services/adminUserService.js";

export async function index(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const result = await listUsers({ limit, cursor, search });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed_to_list_users" });
  }
}

export async function show(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: "userId_required" });
  try {
    const user = await getAdminUser(userId);
    if (!user.userId) return res.status(404).json({ error: "user_not_found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed_to_fetch_user" });
  }
}

export async function update(req: Request, res: Response) {
  const userId = req.params.userId;
  if (!userId) return res.status(400).json({ error: "userId_required" });
  // Note: Password management is now handled through Firebase Auth
  const { email, username, betaTester, admin } = req.body || {};
  try {
    const updated = await updateAdminUser(userId, {
      email,
      username,
      betaTester,
      admin,
    });
    res.json(updated);
  } catch (err: any) {
    const code = err?.message === "no_changes_provided" ? 400 : 500;
    res.status(code).json({ error: err?.message || "failed_to_update_user" });
  }
}
