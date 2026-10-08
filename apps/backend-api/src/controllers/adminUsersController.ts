import type { Request, Response } from "express";
import {
  AdminError,
  deletePlay,
  getAdminUser,
  listUsers,
  resetScreenName,
  setUserDisabled,
  updateAdminUser,
} from "../services/adminUserService.js";
import { sendServerError } from "../lib/http.js";

function fail(res: Response, event: string, err: unknown) {
  if (err instanceof AdminError) return res.status(err.status).json({ error: err.code });
  sendServerError(res, event, err);
}

/** The signed-in admin (requireAuth has run). */
const actorId = (req: Request) => req.user?.userId ?? "";

export async function index(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    res.json(await listUsers({ limit, cursor, search }));
  } catch (err) {
    fail(res, "admin_users_list_failed", err);
  }
}

export async function show(req: Request, res: Response) {
  try {
    res.json(await getAdminUser(String(req.params.userId)));
  } catch (err) {
    fail(res, "admin_user_get_failed", err);
  }
}

export async function update(req: Request, res: Response) {
  const body = (req.body ?? {}) as { betaTester?: unknown; admin?: unknown };
  try {
    const updated = await updateAdminUser(actorId(req), String(req.params.userId), {
      betaTester: body.betaTester,
      admin: body.admin,
    });
    res.json(updated);
  } catch (err) {
    fail(res, "admin_update_user_failed", err);
  }
}

export async function resetName(req: Request, res: Response) {
  try {
    res.json(await resetScreenName(String(req.params.userId)));
  } catch (err) {
    fail(res, "admin_reset_screen_name_failed", err);
  }
}

export async function disable(req: Request, res: Response) {
  try {
    res.json(await setUserDisabled(actorId(req), String(req.params.userId), true));
  } catch (err) {
    fail(res, "admin_disable_user_failed", err);
  }
}

export async function enable(req: Request, res: Response) {
  try {
    res.json(await setUserDisabled(actorId(req), String(req.params.userId), false));
  } catch (err) {
    fail(res, "admin_enable_user_failed", err);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function removePlay(req: Request, res: Response) {
  const playId = String(req.params.playId);
  if (!UUID.test(playId)) return res.status(400).json({ error: "invalid_play_id" });
  try {
    res.json(await deletePlay(playId));
  } catch (err) {
    fail(res, "admin_delete_play_failed", err);
  }
}
