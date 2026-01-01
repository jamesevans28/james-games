/**
 * Sync Usernames from Cognito to DynamoDB and Firebase
 *
 * This script:
 * 1. Lists all users from Cognito user pool
 * 2. Updates DynamoDB users table with username field
 * 3. Updates Firebase custom claims with username
 *
 * Run with: npx tsx scripts/sync-usernames-from-cognito.ts
 * Dry run (default): DRY_RUN=true npx tsx scripts/sync-usernames-from-cognito.ts
 * Live run: DRY_RUN=false npx tsx scripts/sync-usernames-from-cognito.ts
 *
 * Prerequisites:
 * - AWS credentials configured
 * - Firebase Admin SDK credentials in .env.local
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
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import admin from "firebase-admin";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// Configuration
const REGION = process.env.AWS_REGION || "ap-southeast-2";
const USER_POOL_ID = "ap-southeast-2_3moEOp16B"; // games4james pool
const TABLE_USERS = process.env.TABLE_USERS || "games4james-users";
const DRY_RUN = process.env.DRY_RUN !== "false"; // Default to dry run

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

interface CognitoUserData {
  userId: string; // sub
  username: string; // Cognito username
  email?: string;
}

async function getAllCognitoUsers(): Promise<CognitoUserData[]> {
  const users: CognitoUserData[] = [];
  let paginationToken: string | undefined;

  console.log("📋 Fetching all users from Cognito...");

  do {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        PaginationToken: paginationToken,
        Limit: 60,
      })
    );

    for (const user of response.Users || []) {
      const attrs = user.Attributes || [];
      const sub = attrs.find((a) => a.Name === "sub")?.Value;
      const email = attrs.find((a) => a.Name === "email")?.Value;
      const username = user.Username;

      if (sub && username) {
        users.push({
          userId: sub,
          username: username.toLowerCase(), // Normalize to lowercase
          email,
        });
      }
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return users;
}

async function updateDynamoUsername(userId: string, username: string): Promise<boolean> {
  try {
    if (DRY_RUN) {
      console.log(`  🔍 [DRY RUN] Would update DynamoDB: username="${username}"`);
      return true;
    }

    await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_USERS,
        Key: { userId },
        UpdateExpression: "SET username = :un, updatedAt = :ua",
        ExpressionAttributeValues: {
          ":un": username,
          ":ua": new Date().toISOString(),
        },
        ConditionExpression: "attribute_exists(userId)",
      })
    );

    console.log(`  ✅ Updated DynamoDB with username: ${username}`);
    return true;
  } catch (e: any) {
    if (e.name === "ConditionalCheckFailedException") {
      console.log(`  ⚠️  User doesn't exist in DynamoDB (might be scores-only)`);
    } else {
      console.error(`  ❌ Failed to update DynamoDB: ${e.message}`);
    }
    return false;
  }
}

async function updateFirebaseUsername(userId: string, username: string): Promise<boolean> {
  try {
    // Get current custom claims
    const firebaseUser = await admin.auth().getUser(userId);
    const currentClaims = firebaseUser.customClaims || {};

    if (DRY_RUN) {
      console.log(`  🔍 [DRY RUN] Would update Firebase claims with username: ${username}`);
      return true;
    }

    // Update custom claims with username
    await admin.auth().setCustomUserClaims(userId, {
      ...currentClaims,
      username: username,
    });

    console.log(`  ✅ Updated Firebase claims with username: ${username}`);
    return true;
  } catch (e: any) {
    if (e.code === "auth/user-not-found") {
      console.log(`  ⚠️  User not found in Firebase (needs migration)`);
    } else {
      console.error(`  ❌ Failed to update Firebase: ${e.message}`);
    }
    return false;
  }
}

async function syncUsernames() {
  console.log("🔄 Syncing usernames from Cognito to DynamoDB and Firebase");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log(`   User Pool: ${USER_POOL_ID}`);
  console.log(`   DynamoDB Table: ${TABLE_USERS}\n`);

  initFirebase();

  // Fetch all Cognito users
  const cognitoUsers = await getAllCognitoUsers();
  console.log(`   Found ${cognitoUsers.length} users\n`);

  if (cognitoUsers.length === 0) {
    console.log("No users found!");
    return;
  }

  let dynamoSuccess = 0;
  let dynamoFailed = 0;
  let firebaseSuccess = 0;
  let firebaseFailed = 0;

  for (const user of cognitoUsers) {
    console.log(`\n👤 ${user.username} (${user.userId.substring(0, 8)}...)`);

    // Update DynamoDB
    const dynamoUpdated = await updateDynamoUsername(user.userId, user.username);
    if (dynamoUpdated) {
      dynamoSuccess++;
    } else {
      dynamoFailed++;
    }

    // Update Firebase
    const firebaseUpdated = await updateFirebaseUsername(user.userId, user.username);
    if (firebaseUpdated) {
      firebaseSuccess++;
    } else {
      firebaseFailed++;
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Sync Summary:");
  console.log(`   Total Cognito users: ${cognitoUsers.length}`);
  console.log("");
  console.log("   DynamoDB updates:");
  console.log(`     ${DRY_RUN ? "Would be " : ""}Successful: ${dynamoSuccess}`);
  console.log(`     Failed/Skipped: ${dynamoFailed}`);
  console.log("");
  console.log("   Firebase updates:");
  console.log(`     ${DRY_RUN ? "Would be " : ""}Successful: ${firebaseSuccess}`);
  console.log(`     Failed/Skipped: ${firebaseFailed}`);

  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN. No changes were made.");
    console.log("   Run with DRY_RUN=false to perform actual sync:");
    console.log("   DRY_RUN=false npx tsx scripts/sync-usernames-from-cognito.ts");
  } else {
    console.log("\n✅ Sync complete!");
    console.log("\nUsers can now log in with their Cognito username + PIN");
  }
}

syncUsernames().catch((err) => {
  console.error("\n❌ Script failed:", err);
  process.exit(1);
});
