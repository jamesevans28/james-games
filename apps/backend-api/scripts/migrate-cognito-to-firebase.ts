/**
 * Cognito to Firebase User Migration Script
 *
 * This script:
 * 1. Lists all Cognito users
 * 2. Creates corresponding Firebase accounts (preserving userId)
 * 3. Users will need to set up new login credentials (username+PIN or social)
 *
 * Run with: npx tsx scripts/migrate-cognito-to-firebase.ts
 *
 * Prerequisites:
 * - AWS credentials configured
 * - Firebase Admin SDK credentials in .env.local
 * - COGNITO_USER_POOL_ID environment variable set
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import admin from "firebase-admin";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// Configuration
const REGION = process.env.AWS_REGION || "ap-southeast-2";
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const TABLE_USERS = process.env.TABLE_USERS || "games4james-users";
const DRY_RUN = process.env.DRY_RUN !== "false"; // Default to dry run

if (!USER_POOL_ID) {
  console.error("❌ COGNITO_USER_POOL_ID environment variable required");
  process.exit(1);
}

// Initialize Firebase Admin
function initFirebase() {
  if (admin.apps.length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Firebase credentials not configured in environment");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  console.log("✅ Firebase Admin initialized");
}

// Initialize AWS clients
const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

interface CognitoUser {
  userId: string; // The sub/userId
  username: string; // Cognito username
  email?: string;
  screenName?: string;
  createdAt?: string;
}

async function listCognitoUsers(): Promise<CognitoUser[]> {
  const users: CognitoUser[] = [];
  let paginationToken: string | undefined;

  do {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        PaginationToken: paginationToken,
      })
    );

    for (const user of response.Users || []) {
      const attrs = user.Attributes || [];
      const sub = attrs.find((a) => a.Name === "sub")?.Value;
      const email = attrs.find((a) => a.Name === "email")?.Value;

      if (sub) {
        users.push({
          userId: sub,
          username: user.Username || sub,
          email,
          createdAt: user.UserCreateDate?.toISOString(),
        });
      }
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return users;
}

async function getDynamoUserData(userId: string) {
  try {
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: TABLE_USERS,
        Key: { userId },
      })
    );
    return result.Item;
  } catch (e) {
    return null;
  }
}

async function createFirebaseUser(cognitoUser: CognitoUser, dynamoData: any): Promise<boolean> {
  try {
    // Check if user already exists in Firebase
    try {
      await admin.auth().getUser(cognitoUser.userId);
      console.log(`  ⏭️  User ${cognitoUser.userId} already exists in Firebase`);
      return true;
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") {
        throw e;
      }
    }

    // Create user with same UID
    const email = cognitoUser.email || dynamoData?.email;
    const displayName = dynamoData?.screenName || cognitoUser.username;

    if (DRY_RUN) {
      console.log(`  🔍 [DRY RUN] Would create Firebase user:`);
      console.log(`      UID: ${cognitoUser.userId}`);
      console.log(`      Email: ${email || "(none)"}`);
      console.log(`      Display Name: ${displayName}`);
      return true;
    }

    await admin.auth().createUser({
      uid: cognitoUser.userId,
      email: email || undefined,
      displayName,
      disabled: false,
    });

    console.log(`  ✅ Created Firebase user: ${cognitoUser.userId}`);
    return true;
  } catch (e: any) {
    console.error(`  ❌ Failed to create user ${cognitoUser.userId}:`, e.message);
    return false;
  }
}

async function updateDynamoForFirebase(userId: string): Promise<boolean> {
  try {
    if (DRY_RUN) {
      console.log(`  🔍 [DRY RUN] Would update DynamoDB user ${userId} accountType to "migrated"`);
      return true;
    }

    await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_USERS,
        Key: { userId },
        UpdateExpression: "SET accountType = :at, migratedFrom = :mf, migratedAt = :ma",
        ExpressionAttributeValues: {
          ":at": "migrated", // Marks as needing credential setup
          ":mf": "cognito",
          ":ma": new Date().toISOString(),
        },
      })
    );

    console.log(`  ✅ Updated DynamoDB record for ${userId}`);
    return true;
  } catch (e: any) {
    console.error(`  ❌ Failed to update DynamoDB for ${userId}:`, e.message);
    return false;
  }
}

async function migrate() {
  console.log("🚀 Starting Cognito to Firebase migration");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`   User Pool: ${USER_POOL_ID}`);
  console.log("");

  initFirebase();

  // Step 1: List Cognito users
  console.log("📋 Fetching Cognito users...");
  const cognitoUsers = await listCognitoUsers();
  console.log(`   Found ${cognitoUsers.length} users\n`);

  if (cognitoUsers.length === 0) {
    console.log("No users to migrate!");
    return;
  }

  // Step 2: Migrate each user
  let success = 0;
  let failed = 0;

  for (const cognitoUser of cognitoUsers) {
    console.log(`\n👤 Migrating: ${cognitoUser.username} (${cognitoUser.userId})`);

    // Get existing DynamoDB data
    const dynamoData = await getDynamoUserData(cognitoUser.userId);
    if (dynamoData) {
      console.log(
        `   📊 DynamoDB data found: screenName="${dynamoData.screenName}", xpTotal=${
          dynamoData.xpTotal || 0
        }`
      );
    } else {
      console.log(`   ℹ️  No DynamoDB user record (might be anonymous/scores only)`);
    }

    // Create Firebase user
    const created = await createFirebaseUser(cognitoUser, dynamoData);
    if (!created) {
      failed++;
      continue;
    }

    // Update DynamoDB record
    if (dynamoData) {
      await updateDynamoForFirebase(cognitoUser.userId);
    }

    success++;
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Migration Summary:");
  console.log(`   Total users: ${cognitoUsers.length}`);
  console.log(`   Successful: ${success}`);
  console.log(`   Failed: ${failed}`);

  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN. No changes were made.");
    console.log("   Run with DRY_RUN=false to perform actual migration.");
  } else {
    console.log("\n✅ Migration complete!");
    console.log("\nNext steps:");
    console.log("1. Notify users to set up new login at your app");
    console.log("2. They can use username+PIN or link social accounts");
    console.log("3. Their scores and data are preserved");
  }
}

migrate().catch(console.error);
