import crypto from "node:crypto";
import { getDb } from "../db/client.js";
import type { NewUser, User } from "../db/schema.js";
import {
  SCREEN_NAME_KEY,
  USERNAME_KEY,
  countRenamesSince,
  getUserById,
  getUserByUsername,
  getUserForUpdate,
  insertUser,
  isScreenNameTaken,
  renameUser,
  uniqueViolation,
  updateUser,
} from "../repos/usersRepo.js";
import { buildSummary, type ExperienceSummary } from "./experienceService.js";
import { canUseAvatar } from "./supporterService.js";
import { SCREEN_NAME_MESSAGES, checkScreenName, generateScreenName } from "./screenNames.js";
import {
  checkEmailVerified,
  createCustomToken,
  deleteFirebaseUser,
  hashPin,
  setUserClaims,
  updateFirebaseUserEmail,
  verifyPin,
} from "./firebaseAuthService.js";
import { toPublicProfile, type PublicProfile } from "./publicProfile.js";
import { getFriendship, isBlockedEitherWay, type Friendship } from "./followersService.js";
import { listStickers } from "../repos/stickersRepo.js";
import { normalizeUsername } from "./usernamePolicy.js";
import { deleteUserRow } from "../repos/accountRepo.js";
import { deleteAttempts } from "../repos/authAttemptsRepo.js";
import { pinKey, userKey } from "./throttle.js";

/** A rule failure with the HTTP status and code the controller should answer with. */
export class UserError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UserError";
  }
}

const notFound = () => new UserError(404, "user_not_found", "User not found");

// ---------------------------------------------------------------------------
// Screen names
// ---------------------------------------------------------------------------

/** A fresh generated name such as "bouncy-otter-42" (T6.7). */
export function newScreenName(): string {
  return generateScreenName(() => crypto.randomInt(1_000_000) / 1_000_000);
}

const GENERATED_NAME_TRIES = 8;
const RENAMES_PER_30_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const nameTaken = () => new UserError(409, "taken", SCREEN_NAME_MESSAGES.taken);

/**
 * Runs `write` until the case-insensitive unique index on screen names
 * (users_screen_name_lower_key) accepts the name. A name the player chose gets one
 * try (409 when taken); a generated one is regenerated on each clash. Any other
 * error, including a username clash, is thrown straight away.
 */
async function withUniqueScreenName<T>(
  chosen: string | null,
  write: (screenName: string) => Promise<T>,
): Promise<T> {
  const tries = chosen ? 1 : GENERATED_NAME_TRIES;
  for (let i = 0; i < tries; i++) {
    try {
      return await write(chosen ?? newScreenName());
    } catch (err) {
      if (uniqueViolation(err) !== SCREEN_NAME_KEY) throw err;
    }
  }
  if (chosen) throw nameTaken();
  throw new Error("screen_name_generation_exhausted");
}

/** Checks a name the player typed against the rules; throws a friendly 400. */
function validChosenName(raw: unknown): string {
  const check = checkScreenName(typeof raw === "string" ? raw : "");
  if (!check.ok) throw new UserError(400, check.problem, SCREEN_NAME_MESSAGES[check.problem]);
  return check.name;
}

/** Creates the row with a generated screen name, unless it already exists. */
async function createWithGeneratedName(
  uid: string,
  fields: Omit<NewUser, "id" | "screenName">,
): Promise<{ user: User; isNew: boolean }> {
  const created = await withUniqueScreenName(null, (screenName) =>
    insertUser({ ...fields, id: uid, screenName }),
  );
  if (created) return { user: created, isNew: true };
  // Lost a race with another request creating the same account.
  const existing = await getUserById(uid);
  if (!existing) throw new Error("user_insert_failed");
  return { user: existing, isNew: false };
}

/**
 * The player renames themselves (T6.7): the name must pass the rules, be free
 * (case-insensitive), and they get 3 changes per 30 days. Recorded in
 * screen_name_history for moderation.
 */
export async function changeScreenName(
  uid: string,
  raw: unknown,
  now = new Date(),
): Promise<string> {
  const desired = validChosenName(raw);
  try {
    return await getDb().transaction(async (tx) => {
      const user = await getUserForUpdate(tx, uid);
      if (!user) throw notFound();
      if (user.screenName === desired) return desired;
      const recent = await countRenamesSince(tx, uid, new Date(now.getTime() - 30 * DAY_MS));
      if (recent >= RENAMES_PER_30_DAYS) {
        throw new UserError(429, "too_many_changes", SCREEN_NAME_MESSAGES.too_many_changes);
      }
      if (await isScreenNameTaken(tx, desired, uid)) throw nameTaken();
      const renamed = await renameUser(tx, user, desired, true);
      if (!renamed) throw notFound();
      return renamed.screenName;
    });
  } catch (err) {
    if (uniqueViolation(err) === SCREEN_NAME_KEY) throw nameTaken();
    throw err;
  }
}

/** Live check for the settings field: rules first, then availability. */
export async function checkScreenNameFor(
  uid: string,
  raw: unknown,
): Promise<{ ok: true; name: string } | { ok: false; code: string; message: string }> {
  const check = checkScreenName(typeof raw === "string" ? raw : "");
  if (!check.ok) {
    return { ok: false, code: check.problem, message: SCREEN_NAME_MESSAGES[check.problem] };
  }
  if (await isScreenNameTaken(getDb(), check.name, uid)) {
    return { ok: false, code: "taken", message: SCREEN_NAME_MESSAGES.taken };
  }
  return { ok: true, name: check.name };
}

// ---------------------------------------------------------------------------
// Registration and sign-in
// ---------------------------------------------------------------------------

/** Creates the row for a newly signed-in anonymous Firebase user (idempotent). */
export async function registerAnonymous(uid: string): Promise<{ user: User; isNew: boolean }> {
  const existing = await getUserById(uid);
  if (existing) return { user: existing, isNew: false };
  return createWithGeneratedName(uid, { accountType: "anonymous" });
}

/**
 * Gives the account a username and PIN (upgrading an anonymous account, or creating
 * the row), then sets the Firebase claims and mints a custom token for the client.
 */
export async function registerUsername(
  uid: string,
  input: { username: string; pin: string; screenName?: string },
): Promise<{ user: User; customToken: string }> {
  const chosenName = input.screenName === undefined ? null : validChosenName(input.screenName);
  const username = normalizeUsername(input.username);
  const fields = {
    username,
    pinHash: await hashPin(input.pin),
    accountType: "username_pin" as const,
  };
  const existing = await getUserById(uid);

  let user: User | null;
  try {
    if (existing && !chosenName) {
      // Keep the current screen name: the login username is never shown publicly.
      user = await updateUser(uid, fields);
    } else {
      const named = { ...fields, screenNameSetByUser: Boolean(chosenName) };
      user = await withUniqueScreenName(
        chosenName,
        async (screenName) =>
          (existing ? null : await insertUser({ ...named, id: uid, screenName })) ??
          updateUser(uid, { ...named, screenName }),
      );
    }
  } catch (err) {
    if (uniqueViolation(err) === USERNAME_KEY) {
      throw new UserError(409, "username_taken", "Username is already taken");
    }
    throw err;
  }
  if (!user) throw new Error("user_upsert_failed");

  const claims = { accountType: "username_pin", username };
  await setUserClaims(uid, claims);
  const customToken = await createCustomToken(uid, claims);
  return { user, customToken };
}

let dummyHash: Promise<string> | null = null;
function dummyPinHash(): Promise<string> {
  dummyHash ??= hashPin(crypto.randomInt(1_000_000).toString().padStart(6, "0"));
  return dummyHash;
}

/**
 * Checks a username + PIN and mints a custom token. Null for an unknown username,
 * an account without a PIN, or a wrong PIN, so callers cannot tell them apart.
 */
export async function loginWithUsername(
  username: string,
  pin: string,
): Promise<{ user: User; customToken: string } | null> {
  const user = await getUserByUsername(username);
  if (!user?.pinHash) {
    // Same bcrypt cost as a real check, so response time doesn't say whether the username exists.
    await verifyPin(pin, await dummyPinHash());
    return null;
  }
  if (!(await verifyPin(pin, user.pinHash))) return null;
  const customToken = await createCustomToken(user.id, {
    accountType: user.accountType,
    username: user.username,
  });
  return { user, customToken };
}

/** Marks the account linked to a social provider (creating the row if it is new). */
export async function linkProvider(
  uid: string,
  token: { email?: string; emailVerified?: boolean },
): Promise<User> {
  const patch = {
    accountType: "linked" as const,
    ...(token.email ? { email: token.email, emailVerified: Boolean(token.emailVerified) } : {}),
  };
  const user = (await updateUser(uid, patch)) ?? (await createWithGeneratedName(uid, patch)).user;
  await setUserClaims(uid, { accountType: "linked" });
  return user;
}

export async function changePin(uid: string, currentPin: string, newPin: string): Promise<void> {
  const user = await getUserById(uid);
  if (!user?.pinHash) {
    throw new UserError(400, "pin_not_set", "Account does not use PIN authentication");
  }
  if (!(await verifyPin(currentPin, user.pinHash))) {
    throw new UserError(401, "wrong_pin", "Current PIN is incorrect");
  }
  await updateUser(uid, { pinHash: await hashPin(newPin) });
}

/** James resets a forgotten PIN; any sign-in lockout on the account is lifted too. */
export async function adminResetPin(userId: string, newPin: string): Promise<void> {
  const user = await updateUser(userId, { pinHash: await hashPin(newPin) });
  if (!user) throw notFound();
  const keys = [pinKey(userId)];
  if (user.username) keys.push(userKey(user.username));
  await deleteAttempts(getDb(), keys);
}

/**
 * DELETE /me (T7.8): removes the account for good. In one transaction the row goes
 * (plays stay, anonymised; best scores, friends, stickers and the rest cascade, so
 * the player leaves every leaderboard), along with any sign-in attempts naming the
 * account, and then the Firebase user is deleted. If Firebase fails the transaction
 * rolls back and nothing is lost, so the player can simply try again.
 */
export async function deleteAccount(uid: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    // No row (never registered, or a retry) still deletes the Firebase user.
    const deleted = await deleteUserRow(tx, uid);
    const keys = [pinKey(uid)];
    if (deleted?.username) keys.push(userKey(deleted.username));
    await deleteAttempts(tx, keys);
    await deleteFirebaseUser(uid);
  });
}

/** Sets an unverified email in Firebase and on the row. Firebase errors are thrown as-is. */
export async function addEmail(uid: string, email: string): Promise<void> {
  if (!(await getUserById(uid))) throw notFound();
  await updateFirebaseUserEmail(uid, email);
  await updateUser(uid, { email, emailVerified: false });
}

/** Reads Firebase's emailVerified and copies a `true` onto the row. */
export async function syncEmailVerified(uid: string): Promise<boolean> {
  const verified = await checkEmailVerified(uid);
  if (verified) await updateUser(uid, { emailVerified: true });
  return verified;
}

// ---------------------------------------------------------------------------
// Profile, preferences
// ---------------------------------------------------------------------------

/** GET /me and GET /auth/firebase/me: the signed-in user's own account. */
export type CurrentUser = {
  userId: string;
  username: string | null;
  screenName: string;
  avatar: number;
  accountType: User["accountType"];
  email: string | null;
  emailVerified: boolean;
  /** Linked sign-in providers, from the ID token. */
  providers: string[];
  preferences: Record<string, unknown>;
  betaTester: boolean;
  admin: boolean;
  experience: ExperienceSummary;
  streak: { current: number; longest: number; lastDay: string | null };
  createdAt: string;
  updatedAt: string;
};

export async function getCurrentUser(
  uid: string,
  token: { email?: string; emailVerified?: boolean; providers?: string[] } = {},
): Promise<CurrentUser | null> {
  const user = await getUserById(uid);
  if (!user) return null;
  // The row is the source of truth; the token fills in an email the row has not caught up with.
  const email = user.email ?? token.email ?? null;
  return {
    userId: user.id,
    username: user.username,
    screenName: user.screenName,
    avatar: user.avatar,
    accountType: user.accountType,
    email,
    emailVerified: user.email ? user.emailVerified : Boolean(email && token.emailVerified),
    providers: token.providers ?? [],
    preferences: user.prefs,
    betaTester: user.betaTester,
    admin: user.admin,
    experience: buildSummary(user),
    streak: {
      current: user.streakCurrent,
      longest: user.streakLongest,
      lastDay: user.streakLastDay,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function updatePreferences(
  uid: string,
  patch: { avatar?: number; preferences?: Record<string, unknown> },
): Promise<void> {
  const set: Partial<NewUser> = {};
  if (patch.avatar !== undefined) {
    if (!(await canUseAvatar(uid, patch.avatar))) {
      throw new UserError(403, "supporter_only", "That avatar is a thank-you for supporters.");
    }
    set.avatar = patch.avatar;
  }
  if (patch.preferences !== undefined) set.prefs = patch.preferences;
  if (!(await updateUser(uid, set))) throw notFound();
}

const PROFILE_STICKERS_LIMIT = 20;

/**
 * GET /users/:userId (T7.6). Whitelisted fields only (see publicProfile.ts): no
 * friend or follower lists or counts, no last-seen. "Friends since" only for the
 * viewer's friends; the friend code only for the player themselves.
 */
export type PublicProfileResponse = {
  profile: PublicProfile;
  /** Sticker ids, newest first (art and names come from the client's catalogue). */
  stickers: string[];
  isSelf: boolean;
  friendship: Friendship | "self";
  friendsSince: string | null;
  /** Only on your own profile, so you can share it. */
  friendCode?: string;
};

/** Null when there is no such player, or when either of the two has blocked the other. */
export async function getPublicProfile(
  targetUserId: string,
  viewerId: string | undefined,
): Promise<PublicProfileResponse | null> {
  const isSelf = viewerId === targetUserId;
  const [user, blocked, stickers, link] = await Promise.all([
    getUserById(targetUserId),
    viewerId && !isSelf ? isBlockedEitherWay(viewerId, targetUserId) : Promise.resolve(false),
    listStickers(targetUserId),
    viewerId && !isSelf ? getFriendship(viewerId, targetUserId) : Promise.resolve(null),
  ]);
  if (!user || blocked) return null;
  return {
    profile: toPublicProfile(user),
    stickers: stickers.slice(0, PROFILE_STICKERS_LIMIT).map((s) => s.stickerId),
    isSelf,
    friendship: isSelf ? "self" : (link?.friendship ?? "none"),
    friendsSince: link?.friendsSince ?? null,
    ...(isSelf ? { friendCode: user.friendCode } : {}),
  };
}
