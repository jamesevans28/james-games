import crypto from "node:crypto";
import type { NewUser, User } from "../db/schema.js";
import {
  SCREEN_NAME_KEY,
  USERNAME_KEY,
  countFollows,
  getUserById,
  getUserByUsername,
  insertUser,
  isFollowingUser,
  listFollowerUsers,
  listFollowingUsers,
  uniqueViolation,
  updateUser,
} from "../repos/usersRepo.js";
import { buildSummary, type ExperienceSummary } from "./experienceService.js";
import {
  checkEmailVerified,
  createCustomToken,
  hashPin,
  setUserClaims,
  updateFirebaseUserEmail,
  verifyPin,
} from "./firebaseAuthService.js";
import { toPublicProfile, type PublicProfile } from "./publicProfile.js";
import { getRecentGamesForUser } from "./userGameStatsService.js";
import { normalizeUsername } from "./usernamePolicy.js";

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

// Fun adjectives and nouns for generated screen names (T6.7 replaces this generator).
const ADJECTIVES = [
  "Brave", "Cheeky", "Clever", "Curious", "Daring", "Eager", "Fearless", "Gentle",
  "Happy", "Jolly", "Keen", "Lively", "Merry", "Noble", "Playful", "Quick", "Silly",
  "Swift", "Witty", "Zany", "Awesome", "Bold", "Cool", "Dazzling", "Epic", "Funky",
  "Giggly", "Hyper", "Jazzy", "Kooky", "Lucky", "Mighty", "Nifty", "Peppy", "Quirky",
  "Rowdy", "Snappy", "Cheerful", "Bouncy", "Zippy",
]; // prettier-ignore

const NOUNS = [
  "Koala", "Panda", "Tiger", "Eagle", "Dolphin", "Penguin", "Otter", "Fox", "Wolf",
  "Bear", "Hawk", "Owl", "Rabbit", "Squirrel", "Deer", "Lion", "Cheetah", "Turtle",
  "Hedgehog", "Monkey", "Parrot", "Racoon", "Badger", "Beaver", "Falcon", "Jaguar",
  "Lemur", "Lynx", "Moose", "Peacock", "Platypus", "Puma", "Raven", "Seal", "Shark",
  "Sloth", "Swan", "Walrus", "Whale", "Zebra",
]; // prettier-ignore

/** A playful generated name such as "BraveKoala". */
export function generatePlayfulName(): string {
  const adjective = ADJECTIVES[crypto.randomInt(ADJECTIVES.length)] ?? "Happy";
  const noun = NOUNS[crypto.randomInt(NOUNS.length)] ?? "Koala";
  return `${adjective}${noun}`;
}

const SCREEN_NAME_RETRIES = 6;

function screenNameCandidates(base: string): string[] {
  const out = [base];
  for (let i = 0; i < SCREEN_NAME_RETRIES; i++) {
    out.push(`${base}#${String(crypto.randomInt(10000)).padStart(4, "0")}`);
  }
  return out;
}

/**
 * Runs `write` with `base`, then `base#NNNN` variants, until the case-insensitive
 * unique index on screen names (users_screen_name_lower_key) accepts one. Any other
 * error, including a username clash, is thrown straight away.
 */
async function withUniqueScreenName<T>(
  base: string,
  write: (screenName: string) => Promise<T>,
): Promise<T> {
  for (const candidate of screenNameCandidates(base)) {
    try {
      return await write(candidate);
    } catch (err) {
      if (uniqueViolation(err) !== SCREEN_NAME_KEY) throw err;
    }
  }
  throw new UserError(
    409,
    "screen_name_taken",
    "could not assign requested screen name; it may be taken",
  );
}

/** Creates the row with a generated screen name, unless it already exists. */
async function createWithGeneratedName(
  uid: string,
  fields: Omit<NewUser, "id" | "screenName">,
): Promise<{ user: User; isNew: boolean }> {
  const created = await withUniqueScreenName(generatePlayfulName(), (screenName) =>
    insertUser({ ...fields, id: uid, screenName }),
  );
  if (created) return { user: created, isNew: true };
  // Lost a race with another request creating the same account.
  const existing = await getUserById(uid);
  if (!existing) throw new Error("user_insert_failed");
  return { user: existing, isNew: false };
}

export async function changeScreenName(uid: string, desired: string): Promise<string> {
  const user = await withUniqueScreenName(desired, (screenName) =>
    updateUser(uid, { screenName, screenNameSetByUser: true }),
  );
  if (!user) throw notFound();
  return user.screenName;
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
  const username = normalizeUsername(input.username);
  const fields = {
    username,
    pinHash: await hashPin(input.pin),
    accountType: "username_pin" as const,
  };
  const existing = await getUserById(uid);

  let user: User | null;
  try {
    if (existing && !input.screenName) {
      // Keep the current screen name: the login username is never shown publicly.
      user = await updateUser(uid, fields);
    } else {
      const named = { ...fields, screenNameSetByUser: Boolean(input.screenName) };
      user = await withUniqueScreenName(
        input.screenName ?? generatePlayfulName(),
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

/**
 * Checks a username + PIN and mints a custom token. Null for an unknown username,
 * an account without a PIN, or a wrong PIN, so callers cannot tell them apart.
 */
export async function loginWithUsername(
  username: string,
  pin: string,
): Promise<{ user: User; customToken: string } | null> {
  const user = await getUserByUsername(username);
  if (!user?.pinHash) return null;
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

export async function adminResetPin(userId: string, newPin: string): Promise<void> {
  const user = await updateUser(userId, { pinHash: await hashPin(newPin) });
  if (!user) throw notFound();
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
  if (patch.avatar !== undefined) set.avatar = patch.avatar;
  if (patch.preferences !== undefined) set.prefs = patch.preferences;
  if (!(await updateUser(uid, set))) throw notFound();
}

const FOLLOW_LIST_LIMIT = 25;
const RECENT_GAMES_LIMIT = 10;

export type PublicFollowEntry = {
  userId: string;
  screenName: string;
  avatar: number;
  createdAt: string;
};

/** GET /users/:userId. Whitelisted fields only (see publicProfile.ts). */
export type PublicProfileResponse = {
  profile: PublicProfile;
  followingCount: number;
  followersCount: number;
  following: PublicFollowEntry[];
  followers: PublicFollowEntry[];
  recentGames: Awaited<ReturnType<typeof getRecentGamesForUser>>;
  isSelf: boolean;
  isFollowing: boolean;
};

export async function getPublicProfile(
  targetUserId: string,
  viewerId: string | undefined,
): Promise<PublicProfileResponse | null> {
  const user = await getUserById(targetUserId);
  if (!user) return null;
  const isSelf = viewerId === targetUserId;
  const [counts, following, followers, recentGames, viewerFollows] = await Promise.all([
    countFollows(targetUserId),
    listFollowingUsers(targetUserId, FOLLOW_LIST_LIMIT),
    listFollowerUsers(targetUserId, FOLLOW_LIST_LIMIT),
    getRecentGamesForUser(targetUserId, RECENT_GAMES_LIMIT),
    viewerId && !isSelf ? isFollowingUser(viewerId, targetUserId) : Promise.resolve(false),
  ]);
  const entry = (e: { userId: string; screenName: string; avatar: number; createdAt: Date }) => ({
    userId: e.userId,
    screenName: e.screenName,
    avatar: e.avatar,
    createdAt: e.createdAt.toISOString(),
  });
  return {
    profile: toPublicProfile(user),
    followingCount: counts.following,
    followersCount: counts.followers,
    following: following.map(entry),
    followers: followers.map(entry),
    recentGames,
    isSelf,
    isFollowing: viewerFollows,
  };
}
