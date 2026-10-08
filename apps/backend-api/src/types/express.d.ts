import type { AuthUser } from "../middleware/authGuards.js";
import type { User } from "../db/schema.js";

// attachUser sets req.user from the verified Firebase ID token (undefined when signed out).
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** The admin's own user row, set by requireAdmin to avoid a second lookup. */
      authProfile?: User;
    }
  }
}

export {};
