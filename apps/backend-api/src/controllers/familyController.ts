import type { Request, Response } from "express";
import {
  FamilyError,
  createFamilyCode,
  getFamily,
  joinFamily,
  unlinkKid,
} from "../services/familyService.js";
import { sendServerError } from "../lib/http.js";

/** Wraps a handler: requires a signed-in user, sends the result as JSON, maps rule errors. */
function handler(fn: (req: Request, userId: string) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    try {
      res.json(await fn(req, userId));
    } catch (err) {
      if (err instanceof FamilyError) return res.status(err.status).json({ error: err.code });
      sendServerError(res, "family_request_failed", err);
    }
  };
}

/** GET /family?tzOffsetMinutes=600 (minutes east of UTC, as the viewer's device reports it). */
export const getFamilyHandler = handler((req, userId) =>
  getFamily(userId, Number(req.query.tzOffsetMinutes)),
);

export const createCodeHandler = handler((_req, userId) => createFamilyCode(userId));

export const joinHandler = handler((req, userId) => {
  const body = (req.body ?? {}) as { code?: unknown };
  return joinFamily(userId, body.code);
});

export const unlinkHandler = handler((req, userId) =>
  unlinkKid(userId, String(req.params.childId)),
);
