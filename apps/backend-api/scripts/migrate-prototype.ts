/**
 * Brings the prototype's players and high scores into Postgres (DECISIONS 2026-10-27).
 *
 *   npm run legacy:import -w apps/backend-api                # dry run: counts only, writes nothing
 *   npm run legacy:import -w apps/backend-api -- --apply     # write
 *   npm run legacy:import -w apps/backend-api -- --undo      # remove everything it wrote
 *   ... -- --from <dir>   read users/scores/gamescores/userGameStats JSON exported with
 *                         `aws dynamodb scan` instead of calling AWS
 *
 * Reads DynamoDB with the aws CLI (the local AWS profile), writes with DATABASE_URL and
 * SUPABASE_URL / SUPABASE_SECRET_KEY from .env.local. Safe to rerun: a player already
 * imported (users.prefs.legacyId) is skipped. Prints counts only, never names or ids.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GoTrueAdminApi } from "@supabase/auth-js";
import dotenv from "dotenv";
import { and, eq, isNotNull, sql } from "drizzle-orm";

dotenv.config({ path: path.join(import.meta.dirname, "..", ".env.local"), quiet: true });

const { getDb } = await import("../src/db/client.js");
const { bestScores, games, plays, userGameStats, users } = await import("../src/db/schema.js");
const { addExperience, loadExperienceLevels } =
  await import("../src/services/experienceService.js");
const { limitsFor } = await import("../src/services/scoringRules.js");
const { checkScreenName, generateScreenName } = await import("../src/services/screenNames.js");
const { syntheticEmail } = await import("../src/services/supabaseAuthService.js");
const { guestId, planImport, unmarshall } = await import("../src/services/legacyImport.js");
type DynamoItem = import("../src/services/legacyImport.js").DynamoItem;
type PlannedPlayer = import("../src/services/legacyImport.js").PlannedPlayer;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const undo = args.includes("--undo");
const fromIdx = args.indexOf("--from");
const fromDir = fromIdx >= 0 ? args[fromIdx + 1] : undefined;
const REGION = process.env.AWS_REGION || "ap-southeast-2";

function table(name: string): Record<string, unknown>[] {
  const raw = fromDir
    ? readFileSync(path.join(fromDir, `${name}.json`), "utf8")
    : execFileSync(
        "aws",
        [
          "dynamodb",
          "scan",
          "--region",
          REGION,
          "--table-name",
          `games4james-${name}`,
          "--output",
          "json",
        ],
        { maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
      );
  return (JSON.parse(raw) as { Items: DynamoItem[] }).Items.map(unmarshall);
}

function authAdmin(): GoTrueAdminApi {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
  return new GoTrueAdminApi({
    url: `${url.replace(/\/+$/, "")}/auth/v1`,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
}

const db = getDb();

if (undo) {
  const imported = await db
    .select({ id: users.id, accountType: users.accountType })
    .from(users)
    .where(isNotNull(sql`${users.prefs}->>'legacyId'`));
  const admin = authAdmin();
  let authDeleted = 0;
  for (const u of imported) {
    if (u.id.startsWith("legacy-")) continue;
    const { error } = await admin.deleteUser(u.id);
    if (!error || error.status === 404) authDeleted++;
  }
  for (const u of imported) {
    await db.delete(plays).where(eq(plays.userId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
  }
  console.log(JSON.stringify({ event: "legacy_undo", players: imported.length, authDeleted }));
  process.exit(0);
}

const gameRows = await db.select().from(games);
const limits = gameRows.map((g) => ({ id: g.id, maxScore: limitsFor(g).maxScore }));
const legacyUsers = table("users");
const scoreRows = [...table("scores"), ...table("gamescores")];
const statRows = table("userGameStats");
const plan = planImport(
  legacyUsers as never,
  scoreRows.filter((s) => typeof s.gameId === "string") as never,
  statRows as never,
  limits,
);

const already = new Set(
  (
    await db
      .select({ legacyId: sql<string>`${users.prefs}->>'legacyId'` })
      .from(users)
      .where(isNotNull(sql`${users.prefs}->>'legacyId'`))
  ).map((r) => r.legacyId),
);
const todo = plan.players.filter((p) => !already.has(p.legacyId));

const summary = {
  event: apply ? "legacy_import" : "legacy_import_dry_run",
  players: plan.players.length,
  pinAccounts: plan.players.filter((p) => p.kind === "pin").length,
  guests: plan.players.filter((p) => p.kind === "guest").length,
  highScores: plan.players.reduce((n, p) => n + p.bests.length, 0),
  alreadyImported: plan.players.length - todo.length,
  ...plan.skipped,
};

async function nameTaken(name: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.screenName}) = lower(${name})`)
    .limit(1);
  return rows.length > 0;
}

async function pickScreenName(p: PlannedPlayer): Promise<{ name: string; kept: boolean }> {
  const check = p.screenName ? checkScreenName(p.screenName) : null;
  if (check?.ok && !(await nameTaken(check.name))) return { name: check.name, kept: true };
  for (;;) {
    const name = generateScreenName();
    if (!(await nameTaken(name))) return { name, kept: false };
  }
}

if (!apply) {
  let renamed = 0;
  let usernameTaken = 0;
  for (const p of todo) {
    const check = p.screenName ? checkScreenName(p.screenName) : null;
    if (!check?.ok || (await nameTaken(check.name))) renamed++;
    if (p.username) {
      const hit = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.username}) = ${p.username}`)
        .limit(1);
      if (hit.length) usernameTaken++;
    }
  }
  console.log(
    JSON.stringify({
      ...summary,
      screenNamesReplaced: renamed,
      usernamesAlreadyTaken: usernameTaken,
    }),
  );
  process.exit(0);
}

const levels = await loadExperienceLevels(db);
const admin = authAdmin();
const result = {
  imported: 0,
  pinImported: 0,
  screenNamesReplaced: 0,
  usernamesAlreadyTaken: 0,
  failed: 0,
};

for (const p of todo) {
  let id = guestId(p.legacyId);
  let createdAuth = false;
  try {
    if (p.kind === "pin" && p.username) {
      const taken = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.username}) = ${p.username}`)
        .limit(1);
      if (taken.length) {
        result.usernamesAlreadyTaken++;
        continue;
      }
      const { data, error } = await admin.createUser({
        email: syntheticEmail(p.username),
        email_confirm: true,
        app_metadata: { account_type: "username_pin" },
      });
      if (error || !data.user) {
        if (error?.status === 422) result.usernamesAlreadyTaken++;
        else result.failed++;
        continue;
      }
      id = data.user.id;
      createdAuth = true;
    }
    const { name, kept } = await pickScreenName(p);
    if (!kept) result.screenNamesReplaced++;
    const xp = addExperience(levels, { level: 1, progress: 0, total: 0 }, p.xpTotal);
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id,
        username: p.kind === "pin" ? p.username : null,
        pinHash: p.kind === "pin" ? p.pinHash : null,
        accountType: p.kind === "pin" ? "username_pin" : "anonymous",
        screenName: name,
        screenNameSetByUser: kept,
        avatar: p.avatar,
        xpTotal: xp.total,
        xpLevel: xp.level,
        xpProgress: xp.progress,
        prefs: { legacyId: p.legacyId },
        createdAt: new Date(p.createdAt),
        lastSeenAt: new Date(
          p.bests.reduce((t, b) => (b.lastPlayedAt > t ? b.lastPlayedAt : t), p.createdAt),
        ),
      });
      for (const b of p.bests) {
        const [play] = await tx
          .insert(plays)
          .values({
            userId: id,
            gameId: b.gameId,
            score: b.score,
            createdAt: new Date(b.achievedAt),
          })
          .returning({ id: plays.id });
        await tx.insert(bestScores).values({
          userId: id,
          gameId: b.gameId,
          score: b.score,
          playId: play!.id,
          achievedAt: new Date(b.achievedAt),
        });
        await tx.insert(userGameStats).values({
          userId: id,
          gameId: b.gameId,
          plays: b.plays,
          bestScore: b.score,
          lastScore: b.lastScore,
          lastPlayedAt: new Date(b.lastPlayedAt),
        });
      }
    });
    result.imported++;
    if (p.kind === "pin") result.pinImported++;
  } catch (err) {
    result.failed++;
    if (createdAuth) await admin.deleteUser(id).catch(() => undefined);
    console.error(
      JSON.stringify({
        event: "legacy_import_player_failed",
        code: (err as { code?: string }).code,
      }),
    );
  }
}

// Keep the guest clean-up honest: an imported guest has plays, so it is never "idle".
const guestsWithoutPlays = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(users)
  .where(
    and(
      isNotNull(sql`${users.prefs}->>'legacyId'`),
      eq(users.accountType, "anonymous"),
      sql`not exists (select 1 from plays where plays.user_id = ${users.id})`,
    ),
  );
console.log(
  JSON.stringify({ ...summary, ...result, guestsWithoutPlays: guestsWithoutPlays[0]?.n ?? 0 }),
);
process.exit(result.failed ? 1 : 0);
