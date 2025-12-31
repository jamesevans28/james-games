/**
 * Cleanup script to remove dummy emails from migrated Firebase users
 *
 * The migration created Firebase accounts with fake emails like user@dummy.local
 * This script removes those emails since they're not needed for custom token auth.
 *
 * Run with: npx tsx scripts/cleanup-dummy-emails.ts
 * Dry run (default): DRY_RUN=true npx tsx scripts/cleanup-dummy-emails.ts
 * Live run: DRY_RUN=false npx tsx scripts/cleanup-dummy-emails.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import admin from "firebase-admin";

const DRY_RUN = process.env.DRY_RUN !== "false";

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

async function cleanupDummyEmails() {
  console.log("🧹 Cleaning up dummy emails from Firebase users");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  initFirebase();

  // List all users
  let pageToken: string | undefined;
  let cleaned = 0;
  let skipped = 0;
  let total = 0;

  do {
    const listResult = await admin.auth().listUsers(1000, pageToken);

    for (const user of listResult.users) {
      total++;

      // Check if this is a dummy email
      if (user.email?.endsWith("@dummy.local")) {
        console.log(`👤 ${user.uid}: ${user.email} → removing email`);

        if (!DRY_RUN) {
          try {
            await admin.auth().updateUser(user.uid, {
              email: undefined,
              emailVerified: false,
            });
            console.log(`   ✅ Email removed`);
            cleaned++;
          } catch (e: any) {
            console.log(`   ❌ Failed: ${e.message}`);
          }
        } else {
          console.log(`   🔍 [DRY RUN] Would remove email`);
          cleaned++;
        }
      } else {
        skipped++;
      }
    }

    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   Total users: ${total}`);
  console.log(`   Dummy emails ${DRY_RUN ? "would be " : ""}cleaned: ${cleaned}`);
  console.log(`   Skipped (real/no email): ${skipped}`);

  if (DRY_RUN) {
    console.log("\n⚠️  This was a DRY RUN. Run with DRY_RUN=false to apply changes.");
  }
}

cleanupDummyEmails().catch(console.error);
