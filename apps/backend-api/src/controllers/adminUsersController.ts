/* eslint-disable @typescript-eslint/no-unsafe-assignment -- TODO T6.3: untyped DynamoDB items; the Drizzle repository layer gives these real row types */
import type { Request, Response } from "express";
import { listUsers, getAdminUser, updateAdminUser } from "../services/adminUserService.js";
import { sendServerError } from "../lib/http.js";
import { errorInfo } from "../lib/errors.js";

export async function index(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const result = await listUsers({ limit, cursor, search });
    res.json(result);
  } catch (err) {
    sendServerError(res, "admin_users_list_failed", err);
  }
}

export async function show(req: Request, res: Response) {
  const userId = String(req.params.userId);
  if (!userId) return res.status(400).json({ error: "userId_required" });
  try {
    const user = await getAdminUser(userId);
    if (!user.userId) return res.status(404).json({ error: "user_not_found" });
    res.json(user);
  } catch (err) {
    sendServerError(res, "admin_user_get_failed", err);
  }
}

export async function update(req: Request, res: Response) {
  const userId = String(req.params.userId);
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
  } catch (err) {
    if (errorInfo(err).message === "no_changes_provided") {
      return res.status(400).json({ error: "no_changes_provided" });
    }
    sendServerError(res, "admin_update_user_failed", err);
  }
}
