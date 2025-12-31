/**
 * Update Firebase custom claims with usernames from DynamoDB
 *
 * This script reads all users with usernames from DynamoDB and updates
 * their Firebase custom claims to include the username for easy access.
 *
 * Run with: npx tsx scripts/update-firebase-usernames.ts
 * Dry run (default): DRY_RUN=true npx tsx scripts/update-firebase-usernames.ts
 * Live run: DRY_RUN=false npx tsx scripts/update-firebase-usernames.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import admin from "firebase-admin";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const DRY_RUN = process.env.DRY_RUN !== "false";
const TABLE_USERS = process.env.TABLE_USERS || "games4james-users";
const REGION = process.env.AWS_REGION || "ap-southeast-2";

// Initialize Firebase Admin
function initFirebase() {
  if (admin.apps.length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("❌ Firebase credentials not configured");
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });

  console.log("✅ Firebase Admin initialized");
}

// Initialize DynamoDB
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

interface DynamoUser {
  userId: string;
  username?: string;
  accountType?: string;
  screenName?: string;
}

async function getAllUsersWithUsernames(): Promise<DynamoUser[]> {
  const users: DynamoUser[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const result = await dynamoClient.send(
      new ScanCommand({
        TableName: TABLE_USERS,
        FilterExpression: "attribute_exists(username)",
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items) {
      users.push(...(result.Items as DynamoUser[]));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return users;
}

async function updateFirebaseUser(user: DynamoUser): Promise<boolean> {
  if (!user.username) return false;

  try {
    // Get current custom claims
    const firebaseUser = await admin.auth().getUser(user.userId);
    const currentClaims = firebaseUser.customClaims || {};

    if (DRY_RUN) {
      console.log(`  🔍 [DRY RUN] Would update claims:`);
      console.log(`      Current: ${JSON.stringify(currentClaims)}`);
      console.log(`      New: ${JSON.stringify({ ...currentClaims, username: user.username })}`);
      return true;
    }

    // Update custom claims with username
    await admin.auth().setCustomUserClaims(user.userId, {
      ...currentClaims,
      username: user.username,
    });

    console.log(`  ✅ Updated claims with username: ${user.username}`);
    return true;
  } catch (e: any) {
    if (e.code === "auth/user-not-found") {
      console.log(`  ⚠️  User not found in Firebase (may need migration)`);
    } else {
      console.error(`  ❌ Failed: ${e.message}`);
    }
    return false;
  }
}

async function updateUsernames() {
  console.log("🔄 Updating Firebase custom claims with usernames");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`   DynamoDB Table: ${TABLE_USERS}\n`);

  initFirebase();

  console.log("📋 Fetching users from DynamoDB...");
  const users = await getAllUsersWithUsernames();
  console.log(`   Found ${users.length} users with usernames\n`);

  if (users.length === 0) {
    console.log("No users to update!");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const user of users) {
    console.log(`\n👤 ${user.username} (${user.userId})`);
    console.log(`   Screen Name: ${user.screenName}`);
    console.log(`   Account Type: ${user.accountType || "unknown"}`);

    const updated = await updateFirebaseUser(user);
    if (updated) {
      success++;
    } else {
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   Total users: ${users.length}`);
  console.log(`   ${DRY_RUN ? "Would be " : ""}Updated: ${success}`);
  console.log(`   Failed: ${failed}`);

  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN. Run with DRY_RUN=false to apply changes.");
  } else {
    console.log("\n✅ Update complete!");
    console.log("   Usernames are now stored in Firebase custom claims.");
  }
}

updateUsernames().catch(console.error);
