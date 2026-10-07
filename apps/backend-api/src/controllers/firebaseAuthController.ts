// Firebase Authentication Controller
// Handles auth flows for: Anonymous, Username+PIN, and Linked (social/email) accounts
import type { Request, Response } from "express";
import {
  createCustomToken,
  hashPin,
  verifyPin,
  checkRateLimit,
  recordLoginAttempt,
  setUserClaims,
  verifyIdToken,
  updateFirebaseUserEmail,
  checkEmailVerified,
} from "../services/firebaseAuthService.js";
import { putUser, getUser } from "../services/dynamoService.js";
import { createUniqueScreenName, generatePlayfulName } from "../services/userService.js";
import { isUsernameTakenByOther } from "../services/usernamePolicy.js";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import { log } from "../lib/log.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

// Username validation
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const PIN_REGEX = /^\d{4,8}$/;

/**
 * Register an anonymous user who wants to upgrade to username+PIN.
 * POST /auth/firebase/register-username
 * Body: { username, pin, screenName?, firebaseToken }
 *
 * firebaseToken should be the ID token from the anonymous Firebase user.
 */
export async function registerWithUsername(req: Request, res: Response) {
  const { username, pin, screenName, firebaseToken } = (req.body || {}) as {
    username?: string;
    pin?: string;
    screenName?: string;
    firebaseToken?: string;
  };

  if (!username || !pin || !firebaseToken) {
    return res.status(400).json({ error: "username, pin, and firebaseToken required" });
  }

  // Validate username format
  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({
      error: "Username must be 3-20 characters, letters, numbers, and underscores only",
    });
  }

  // Validate PIN format
  if (!PIN_REGEX.test(pin)) {
    return res.status(400).json({
      error: "PIN must be 4-8 digits",
    });
  }

  try {
    // Verify the Firebase token to get the user's UID
    const decodedToken = await verifyIdToken(firebaseToken);
    const uid = decodedToken.uid;

    // A username owned by another account can never be claimed here, whatever its
    // accountType. Recovering an old account is an admin action (POST /auth/firebase/admin/reset-pin).
    const existingUser = await findUserByUsername(username.toLowerCase());
    if (isUsernameTakenByOther(existingUser, uid)) {
      return res.status(409).json({ error: "Username is already taken", code: "username_taken" });
    }

    // Hash the PIN
    const pinHash = await hashPin(pin);

    // Create or update user profile in DynamoDB
    const displayName = screenName || username;
    const assignedScreenName = await createUniqueScreenName(displayName, uid);

    // Check if user already exists (upgrading from anonymous)
    const existingProfile = await getUser(uid);
    if (existingProfile) {
      // Update existing profile
      await updateUserToUsernamePin(uid, {
        username: username.toLowerCase(),
        pinHash,
        screenName: assignedScreenName,
        accountType: "username_pin",
      });
    } else {
      // Create new profile
      await putUserWithUsername({
        userId: uid,
        username: username.toLowerCase(),
        pinHash,
        screenName: assignedScreenName,
        accountType: "username_pin",
      });
    }

    // Set custom claims on the Firebase user (including username for easy access)
    await setUserClaims(uid, {
      accountType: "username_pin",
      username: username.toLowerCase(),
    });

    // Return a custom token with updated claims
    const customToken = await createCustomToken(uid, {
      accountType: "username_pin",
      username: username.toLowerCase(),
    });

    return res.json({
      ok: true,
      customToken,
      screenName: assignedScreenName,
      accountType: "username_pin",
    });
  } catch (e: any) {
    log.error("register_username_failed", undefined, e);
    return res.status(500).json({ error: e?.message || "Registration failed" });
  }
}

/**
 * Sign in with username + PIN.
 * POST /auth/firebase/login-username
 * Body: { username, pin }
 *
 * Returns a Firebase custom token that the client exchanges for an ID token.
 */
export async function loginWithUsername(req: Request, res: Response) {
  const { username, pin } = (req.body || {}) as {
    username?: string;
    pin?: string;
  };

  if (!username || !pin) {
    return res.status(400).json({ error: "username and pin required" });
  }

  // Rate limiting check
  const rateLimitKey = `login:${username.toLowerCase()}`;
  const rateCheck = checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: "Too many login attempts. Please try again later.",
      retryAfter: rateCheck.retryAfter,
    });
  }

  try {
    // Find user by username
    const user = await findUserByUsername(username.toLowerCase());
    if (!user) {
      recordLoginAttempt(rateLimitKey, false);
      return res.status(401).json({ error: "Invalid username or PIN" });
    }

    // Accounts without a PIN (old migrated rows) get the same answer as a wrong PIN,
    // so the response never confirms that a username exists.
    if (!user.pinHash) {
      recordLoginAttempt(rateLimitKey, false);
      return res.status(401).json({ error: "Invalid username or PIN" });
    }

    // Verify PIN
    const isValid = await verifyPin(pin, user.pinHash);
    if (!isValid) {
      recordLoginAttempt(rateLimitKey, false);
      return res.status(401).json({ error: "Invalid username or PIN" });
    }

    // Record successful login
    recordLoginAttempt(rateLimitKey, true);

    // Create custom token
    const customToken = await createCustomToken(user.userId, {
      accountType: user.accountType || "username_pin",
      username: user.username,
    });

    return res.json({
      ok: true,
      customToken,
      userId: user.userId,
      screenName: user.screenName,
      accountType: user.accountType || "username_pin",
    });
  } catch (e: any) {
    log.error("login_username_failed", undefined, e);
    return res.status(500).json({ error: e?.message || "Login failed" });
  }
}

/**
 * Register an anonymous Firebase user.
 * POST /auth/firebase/register-anonymous
 * Body: { firebaseToken }
 *
 * Creates a user record in DynamoDB for the anonymous user.
 * Called after client-side anonymous sign-in to sync with our backend.
 */
export async function registerAnonymous(req: Request, res: Response) {
  const { firebaseToken } = (req.body || {}) as { firebaseToken?: string };

  if (!firebaseToken) {
    return res.status(400).json({ error: "firebaseToken required" });
  }

  try {
    const decodedToken = await verifyIdToken(firebaseToken);
    const uid = decodedToken.uid;

    // Check if user already exists
    const existingUser = await getUser(uid);
    if (existingUser) {
      // User already registered, just return their info
      return res.json({
        ok: true,
        userId: uid,
        screenName: existingUser.screenName,
        accountType: existingUser.accountType || "anonymous",
        isNew: false,
      });
    }

    // Generate a fun playful screen name for anonymous users
    const tempScreenName = generatePlayfulName();
    const assignedScreenName = await createUniqueScreenName(tempScreenName, uid);

    // Create user profile
    await putUserAnonymous({
      userId: uid,
      screenName: assignedScreenName,
      accountType: "anonymous",
    });

    return res.json({
      ok: true,
      userId: uid,
      screenName: assignedScreenName,
      accountType: "anonymous",
      isNew: true,
    });
  } catch (e: any) {
    log.error("register_anonymous_failed", undefined, e);
    return res.status(500).json({ error: e?.message || "Registration failed" });
  }
}

/**
 * Link a social provider (Google, Apple) or email to an existing account.
 * POST /auth/firebase/link-provider
 * Body: { firebaseToken }
 *
 * The firebaseToken should be from after the user linked their provider on the client.
 */
export async function linkProvider(req: Request, res: Response) {
  const { firebaseToken } = (req.body || {}) as { firebaseToken?: string };

  if (!firebaseToken) {
    return res.status(400).json({ error: "firebaseToken required" });
  }

  try {
    const decodedToken = await verifyIdToken(firebaseToken);
    const uid = decodedToken.uid;

    // Get linked providers from token
    const providers = decodedToken.firebase?.identities
      ? Object.keys(decodedToken.firebase.identities)
      : [];

    // Get email if available
    const email = decodedToken.email;
    const emailVerified = decodedToken.email_verified;

    // Update user profile
    await updateUserProviders(uid, {
      providers,
      email,
      emailVerified,
      accountType: "linked",
    });

    // Update Firebase custom claims
    await setUserClaims(uid, { accountType: "linked" });

    return res.json({
      ok: true,
      providers,
      email,
      emailVerified,
      accountType: "linked",
    });
  } catch (e: any) {
    log.error("link_provider_failed", undefined, e);
    return res.status(500).json({ error: e?.message || "Linking failed" });
  }
}

/**
 * Change PIN for username+PIN users.
 * POST /auth/firebase/change-pin
 * Body: { currentPin, newPin }
 * Requires: authenticated user with username+PIN account
 */
export async function changePin(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { currentPin, newPin } = (req.body || {}) as {
    currentPin?: string;
    newPin?: string;
  };

  if (!currentPin || !newPin) {
    return res.status(400).json({ error: "currentPin and newPin required" });
  }

  if (!PIN_REGEX.test(newPin)) {
    return res.status(400).json({ error: "New PIN must be 4-8 digits" });
  }

  try {
    const profile = await getUser(user.userId);
    if (!profile?.pinHash) {
      return res.status(400).json({ error: "Account does not use PIN authentication" });
    }

    // Verify current PIN
    const isValid = await verifyPin(currentPin, profile.pinHash);
    if (!isValid) {
      return res.status(401).json({ error: "Current PIN is incorrect" });
    }

    // Hash and save new PIN
    const newPinHash = await hashPin(newPin);
    await ddb.send(
      new UpdateCommand({
        TableName: config.tables.users,
        Key: { userId: user.userId },
        UpdateExpression: "SET pinHash = :ph, updatedAt = :u",
        ExpressionAttributeValues: {
          ":ph": newPinHash,
          ":u": new Date().toISOString(),
        },
      })
    );

    return res.json({ ok: true });
  } catch (e: any) {
    log.error("change_pin_failed", undefined, e);
    return res.status(500).json({ error: e?.message || "Failed to change PIN" });
  }
}

/**
 * Add or update email address on the user's account.
 * POST /auth/firebase/add-email
 * Body: { email }
 * Requires: authenticated user
 */
export async function addEmail(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { email } = (req.body || {}) as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email address required" });
  }

  try {
    // Update email in Firebase
    await updateFirebaseUserEmail(user.userId, email);

    // Update email in DynamoDB
    await ddb.send(
      new UpdateCommand({
        TableName: config.tables.users,
        Key: { userId: user.userId },
        UpdateExpression:
          "SET email = :em, emailProvided = :ep, emailVerified = :ev, validated = :ev, updatedAt = :u",
        ExpressionAttributeValues: {
          ":em": email,
          ":ep": true,
          ":ev": false,
          ":u": new Date().toISOString(),
        },
      })
    );

    return res.json({ ok: true, email, emailVerified: false });
  } catch (e: any) {
    log.error("add_email_failed", undefined, e);
    // Handle specific Firebase errors
    if (e.code === "auth/email-already-exists") {
      return res
        .status(409)
        .json({ error: "This email is already associated with another account" });
    }
    if (e.code === "auth/invalid-email") {
      return res.status(400).json({ error: "Invalid email address format" });
    }
    return res.status(500).json({ error: e?.message || "Failed to add email" });
  }
}

/**
 * Check and sync email verification status from Firebase.
 * POST /auth/firebase/check-email-verified
 * Requires: authenticated user
 */
export async function checkEmailVerifiedStatus(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const isVerified = await checkEmailVerified(user.userId);

    // Sync to DynamoDB if verified
    if (isVerified) {
      await ddb.send(
        new UpdateCommand({
          TableName: config.tables.users,
          Key: { userId: user.userId },
          UpdateExpression: "SET emailVerified = :ev, validated = :ev, updatedAt = :u",
          ExpressionAttributeValues: {
            ":ev": true,
            ":u": new Date().toISOString(),
          },
        })
      );
    }

    return res.json({ ok: true, emailVerified: isVerified });
  } catch (e: any) {
    log.error("check_email_verified_failed", undefined, e);
    return res.status(500).json({ error: e?.message || "Failed to check verification status" });
  }
}

/**
 * Get current user info (authenticated endpoint).
 * GET /auth/firebase/me
 */
export async function getCurrentUser(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const profile = await getUser(user.userId);
    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      userId: profile.userId,
      screenName: profile.screenName,
      username: profile.username,
      email: profile.email,
      emailVerified: profile.emailVerified,
      accountType: profile.accountType || "anonymous",
      providers: profile.providers || [],
      avatar: profile.avatar,
      createdAt: profile.createdAt,
    });
  } catch (e: any) {
    log.error("get_current_user_failed", undefined, e);
    return res.status(500).json({ error: e?.message || "Failed to get user" });
  }
}

// Helper functions

async function findUserByUsername(username: string) {
  // Query the GSI on username
  if (!config.tables.users) {
    log.error("find_user_by_username_unconfigured");
    throw new Error("users_table_not_configured");
  }

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: config.tables.users,
        IndexName: "username-index",
        KeyConditionExpression: "username = :u",
        ExpressionAttributeValues: { ":u": username },
        Limit: 1,
      })
    );
    return result.Items?.[0] as any | undefined;
  } catch (e: any) {
    // Fail closed: if the lookup errors we must not treat the username as free.
    // (If the username-index GSI is missing, run: npx tsx scripts/add-username-gsi.ts)
    log.error("find_user_by_username_failed", undefined, e);
    throw e;
  }
}

async function putUserWithUsername(args: {
  userId: string;
  username: string;
  pinHash: string;
  screenName: string;
  accountType: string;
}) {
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: config.tables.users,
      Item: {
        userId: args.userId,
        username: args.username,
        pinHash: args.pinHash,
        screenName: args.screenName,
        accountType: args.accountType,
        emailProvided: false,
        email: null,
        validated: false,
        xpLevel: 1,
        xpProgress: 0,
        xpTotal: 0,
        xpUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );
}

async function putUserAnonymous(args: { userId: string; screenName: string; accountType: string }) {
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: config.tables.users,
      Item: {
        userId: args.userId,
        screenName: args.screenName,
        accountType: args.accountType,
        emailProvided: false,
        email: null,
        validated: false,
        xpLevel: 1,
        xpProgress: 0,
        xpTotal: 0,
        xpUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );
}

async function updateUserToUsernamePin(
  userId: string,
  args: {
    username: string;
    pinHash: string;
    screenName: string;
    accountType: string;
  }
) {
  await ddb.send(
    new UpdateCommand({
      TableName: config.tables.users,
      Key: { userId },
      UpdateExpression:
        "SET username = :un, pinHash = :ph, screenName = :sn, accountType = :at, updatedAt = :u",
      ExpressionAttributeValues: {
        ":un": args.username,
        ":ph": args.pinHash,
        ":sn": args.screenName,
        ":at": args.accountType,
        ":u": new Date().toISOString(),
      },
    })
  );
}

async function updateUserProviders(
  userId: string,
  args: {
    providers: string[];
    email?: string;
    emailVerified?: boolean;
    accountType: string;
  }
) {
  const updateParts = ["providers = :pr", "accountType = :at", "updatedAt = :u"];
  const values: Record<string, any> = {
    ":pr": args.providers,
    ":at": args.accountType,
    ":u": new Date().toISOString(),
  };

  if (args.email) {
    updateParts.push("email = :em", "emailProvided = :ep");
    values[":em"] = args.email;
    values[":ep"] = true;
  }
  if (args.emailVerified !== undefined) {
    updateParts.push("emailVerified = :ev", "validated = :ev");
    values[":ev"] = args.emailVerified;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: config.tables.users,
      Key: { userId },
      UpdateExpression: "SET " + updateParts.join(", "),
      ExpressionAttributeValues: values,
    })
  );
}

/**
 * Admin endpoint to reset a user's PIN
 * POST /auth/firebase/admin/reset-pin
 */
export async function adminResetUserPin(req: Request, res: Response) {
  try {
    // Check if requester is admin
    // @ts-ignore
    const requester = req.user;
    if (!requester?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get requester profile to check admin status
    const requesterProfile = await getUser(requester.userId);
    if (!requesterProfile?.admin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId, newPin } = req.body;

    if (!userId || !newPin) {
      return res.status(400).json({ error: "userId and newPin required" });
    }

    if (!/^\d{4,8}$/.test(newPin)) {
      return res.status(400).json({ error: "PIN must be 4-8 digits" });
    }

    // Hash the new PIN
    const pinHash = await hashPin(newPin);

    // Update DynamoDB
    await ddb.send(
      new UpdateCommand({
        TableName: config.tables.users,
        Key: { userId },
        UpdateExpression: "SET pinHash = :pinHash, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":pinHash": pinHash,
          ":updatedAt": new Date().toISOString(),
        },
      })
    );

    log.info("admin_pin_reset");
    res.json({ success: true, message: "PIN reset successfully" });
  } catch (error) {
    log.error("admin_pin_reset_failed", undefined, error);
    res.status(500).json({ error: "Failed to reset PIN" });
  }
}
