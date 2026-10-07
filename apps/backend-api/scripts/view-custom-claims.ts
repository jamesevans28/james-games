/**
 * View Firebase custom claims for all users
 *
 * Run with: npx tsx scripts/view-custom-claims.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import admin from "firebase-admin";

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
}

async function viewCustomClaims() {
  console.log("🔍 Viewing Firebase Custom Claims\n");

  initFirebase();

  let pageToken: string | undefined;
  let userCount = 0;
  let usersWithClaims = 0;
  const claimKeyCounts = new Map<string, number>();

  do {
    const listResult = await admin.auth().listUsers(1000, pageToken);

    for (const user of listResult.users) {
      userCount++;
      const claims = user.customClaims || {};

      if (Object.keys(claims).length > 0) {
        usersWithClaims++;
        // Counts only: claims can contain usernames, so values are never printed.
        const provider = user.providerData[0]?.providerId || "custom";
        for (const key of Object.keys(claims)) {
          const k = `${provider} · ${key}`;
          claimKeyCounts.set(k, (claimKeyCounts.get(k) ?? 0) + 1);
        }
      }
    }

    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log("=".repeat(60));
  console.log(`📊 Summary:`);
  console.log(`   Total users: ${userCount}`);
  console.log(`   Users with custom claims: ${usersWithClaims}`);
  console.log(`   Users without claims: ${userCount - usersWithClaims}`);
  console.log(`   Claim keys by provider:`);
  for (const [k, n] of [...claimKeyCounts].sort()) console.log(`     ${k}: ${n}`);
}

viewCustomClaims().catch((e) => console.error("Failed:", e?.code ?? e?.name ?? "error"));
