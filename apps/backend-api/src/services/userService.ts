import { config } from "../config/index.js";
import {
  getUser,
  updateUserEmailMetadata,
  updateUserPreferences,
  putUser,
} from "./dynamoService.js";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import crypto from "crypto";
import { buildSummary } from "./experienceService.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

// Fun adjectives and nouns for generating playful screen names
const ADJECTIVES = [
  "Brave",
  "Cheeky",
  "Clever",
  "Curious",
  "Daring",
  "Eager",
  "Fearless",
  "Gentle",
  "Happy",
  "Jolly",
  "Keen",
  "Lively",
  "Merry",
  "Noble",
  "Playful",
  "Quick",
  "Silly",
  "Swift",
  "Witty",
  "Zany",
  "Awesome",
  "Bold",
  "Cool",
  "Dazzling",
  "Epic",
  "Funky",
  "Giggly",
  "Hyper",
  "Jazzy",
  "Kooky",
  "Lucky",
  "Mighty",
  "Nifty",
  "Peppy",
  "Quirky",
  "Rowdy",
  "Snappy",
  "Cheerful",
  "Bouncy",
  "Zippy",
];

const NOUNS = [
  "Koala",
  "Panda",
  "Tiger",
  "Eagle",
  "Dolphin",
  "Penguin",
  "Otter",
  "Fox",
  "Wolf",
  "Bear",
  "Hawk",
  "Owl",
  "Rabbit",
  "Squirrel",
  "Deer",
  "Lion",
  "Cheetah",
  "Turtle",
  "Hedgehog",
  "Monkey",
  "Parrot",
  "Racoon",
  "Badger",
  "Beaver",
  "Falcon",
  "Jaguar",
  "Lemur",
  "Lynx",
  "Moose",
  "Peacock",
  "Platypus",
  "Puma",
  "Raven",
  "Seal",
  "Shark",
  "Sloth",
  "Swan",
  "Walrus",
  "Whale",
  "Zebra",
];

/**
 * Generate a fun, playful screen name by combining a random adjective and noun.
 * Examples: "BraveKoala", "CheekySquirrel", "MightyPenguin"
 */
export function generatePlayfulName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective}${noun}`;
}

// High-level user service that consolidates user/profile/settings logic.
// Controllers should call these functions instead of talking to Dynamo directly.

export async function getProfile(userId: string) {
  const profile = await getUser(userId);
  return {
    userId,
    screenName: profile?.screenName ?? null,
    email: profile?.email ?? null,
    emailProvided: profile?.emailProvided ?? false,
    avatar: profile?.avatar ?? null,
    preferences: profile?.preferences ?? {},
    validated: profile?.validated ?? false,
    betaTester: Boolean(profile?.betaTester),
    admin: Boolean(profile?.admin),
    createdAt: profile?.createdAt ?? null,
    updatedAt: profile?.updatedAt ?? null,
    experience: profile ? buildSummary(profile) : null,
  };
}

export async function changeScreenName(userId: string, desired: string) {
  const trimmed = desired.trim();
  if (!trimmed || trimmed.length < 2) throw new Error("screenName must be >= 2 chars");

  try {
    // Reserve a unique screen name (may append #NNNN) then update the user record.
    const assigned = await createUniqueScreenName(trimmed, userId);
    const current = await getUser(userId);

    // If the user row doesn't exist yet, create it and return immediately.
    if (!current) {
      try {
        // putUser uses a conditional Put to avoid overwriting an existing user.
        await putUser({ userId, screenName: assigned, emailProvided: false, email: null });
        return assigned;
      } catch (e) {
        // If a concurrent writer created the user, fall through to the update path below.
      }
    }

    await ddb.send(
      new UpdateCommand({
        TableName: config.tables.users,
        Key: { userId },
        UpdateExpression: "SET screenName = :sn, updatedAt = :u",
        ExpressionAttributeValues: { ":sn": assigned, ":u": new Date().toISOString() },
        ConditionExpression: "attribute_exists(userId)",
      })
    );
    if (current?.screenName && current.screenName.toLowerCase() !== assigned.toLowerCase()) {
      await releaseScreenName(current.screenName);
    }
    return assigned;
  } catch (e: any) {
    // Translate common Dynamo conditional failures into a clearer error message
    const msg = e?.message || String(e);
    if (
      msg.includes("could not reserve unique screen name") ||
      msg.includes("ConditionalCheckFailed")
    ) {
      const err = new Error("could not assign requested screen name; it may be taken");
      // attach a code to allow callers to map to 409 if desired
      // @ts-ignore
      err.code = "CONFLICT";
      throw err;
    }
    throw e;
  }
}

function randomFourDigits() {
  const n = crypto.randomInt(0, 10000);
  return String(n).padStart(4, "0");
}

async function reserveScreenName(screenName: string, userId: string) {
  if (!config.tables.usernames) return true;
  const key = screenName.toLowerCase();
  // Check existing reservation
  try {
    const existing = await ddb.send(
      new GetCommand({ TableName: config.tables.usernames, Key: { screenNameKey: key } })
    );
    const item = existing.Item as any | undefined;
    if (item) {
      // If it's already owned by this user, allow reuse
      if (item.ownerId === userId) return true;
      // Owned by someone else — cannot reserve
      return false;
    }
  } catch (e) {
    // fall through to try Put; we'll still attempt to put below
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: config.tables.usernames,
        Item: {
          screenNameKey: key,
          ownerId: userId,
          displayName: screenName,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(screenNameKey)",
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function releaseScreenName(screenName: string) {
  if (!config.tables.usernames) return;
  await ddb.send(
    new DeleteCommand({
      TableName: config.tables.usernames,
      Key: { screenNameKey: screenName.toLowerCase() },
    })
  );
}

/**
 * Reserve a unique screen name. If the requested name is taken, try suffixing
 * with `#NNNN` up to maxAttempts times. Returns the actual assigned screen name.
 */
export async function createUniqueScreenName(desired: string, userId: string, maxAttempts = 6) {
  const base = desired.trim();
  if (!base) throw new Error("empty screen name");

  // try base name first
  if (await reserveScreenName(base, userId)) return base;

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = `${base}#${randomFourDigits()}`;
    if (await reserveScreenName(candidate, userId)) return candidate;
  }

  throw new Error("could not reserve unique screen name");
}

export async function updatePreferencesForUser(userId: string, patch: Record<string, any>) {
  return updateUserPreferences(userId, patch);
}

// Note: Email update/verification is now handled through Firebase Auth linked accounts.
// Users can link their account to a social provider (Google/Apple) which will provide verified email.

export default {
  getProfile,
  changeScreenName,
  updatePreferencesForUser,
};
