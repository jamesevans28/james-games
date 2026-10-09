import type { Request, Response } from "express";
import {
  AdminError,
  deletePlay,
  getAdminUser,
  listUsers,
  recentNameChanges,
  resetScreenName,
  setUserDisabled,
  updateAdminUser,
} from "../services/adminUserService.js";
import { sendServerError } from "../lib/http.js";
import { getUserById } from "../repos/usersRepo.js";
import { revokeSupporter } from "../repos/supportersRepo.js";
import { grant } from "../services/supporterService.js";

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

/** GET /admin/screen-names?limit= : the latest renames, newest first (T6.7). */
export async function nameChanges(req: Request, res: Response) {
  try {
    res.json({ items: await recentNameChanges(Number(req.query.limit) || 50) });
  } catch (err) {
    fail(res, "admin_name_changes_failed", err);
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

/** POST /admin/users/:userId/supporter: a manual grant (Ko-fi supporters, T12.1/T12.2). */
export async function grantSupport(req: Request, res: Response) {
  try {
    const userId = String(req.params.userId);
    if (!(await getUserById(userId))) return res.status(404).json({ error: "user_not_found" });
    const outcome = await grant(userId, "manual", `admin:${new Date().toISOString().slice(0, 10)}`);
    res.json({ ok: true, outcome });
  } catch (err) {
    fail(res, "admin_grant_supporter_failed", err);
  }
}

/** DELETE /admin/users/:userId/supporter */
export async function revokeSupport(req: Request, res: Response) {
  try {
    res.json({ ok: await revokeSupporter(String(req.params.userId)) });
  } catch (err) {
    fail(res, "admin_revoke_supporter_failed", err);
  }
}
