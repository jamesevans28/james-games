#!/usr/bin/env node
/**
 * Sets up Resend as Supabase Auth's mail server (plan T14.9). See
 * docs/supabase-auth-setup.md, "Email delivery".
 *
 *   node scripts/resend-setup.mjs --dry-run   # what it would do; changes nothing
 *   node scripts/resend-setup.mjs             # do it (safe to rerun)
 *
 * 1. Adds games4james.com to Resend (region ap-northeast-1, nearest to Australia).
 * 2. Writes Resend's DNS records (DKIM, and SPF/MX on the `send` subdomain) into the
 *    Route 53 zone with the AWS CLI. It never replaces a different existing record;
 *    it stops and says which one instead.
 * 3. Asks Resend to verify the domain and waits (up to 10 minutes; rerun if it times out).
 * 4. Creates a send-only Resend key limited to that domain for Supabase, kept in
 *    ~/.config/games4james/resend-smtp-key (never printed).
 * 5. Runs scripts/supabase-auth-setup.mjs with Resend's SMTP settings, which also turns
 *    on the code-only email templates.
 *
 * Needs a full-access Resend API key in RESEND_API_KEY or in the file named by
 * RESEND_API_KEY_FILE (default ~/.config/games4james/resend-api-key), the AWS CLI signed
 * in to the account that owns the Route 53 zone, and the Supabase access token that
 * supabase-auth-setup.mjs reads. The sender is noreply@<domain> unless RESEND_FROM is set.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const brand = JSON.parse(
  readFileSync(path.join(ROOT, "apps/player-web/src/config/brand.json"), "utf8"),
);
const DOMAIN = new URL(brand.origin).hostname;
const REGION = "ap-northeast-1";
const FROM = process.env.RESEND_FROM || `noreply@${DOMAIN}`;
const CONFIG_DIR = path.join(os.homedir(), ".config/games4james");
const SMTP_KEY_FILE = path.join(CONFIG_DIR, "resend-smtp-key");
const API = "https://api.resend.com";
const dryRun = process.argv.includes("--dry-run");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readSecret(envName, fileEnvName, defaultFile) {
  if (process.env[envName]?.trim()) return process.env[envName].trim();
  const file = process.env[fileEnvName] ?? defaultFile;
  return existsSync(file) ? readFileSync(file, "utf8").trim() || null : null;
}

const apiKey = readSecret(
  "RESEND_API_KEY",
  "RESEND_API_KEY_FILE",
  path.join(CONFIG_DIR, "resend-api-key"),
);
if (apiKey && !apiKey.startsWith("re_"))
  fail("That doesn't look like a Resend API key (they start with re_).");
if (!apiKey && !dryRun) {
  fail(
    "No Resend API key. resend.com → API Keys → Create (Full access), copy it, then:\n" +
      "  mkdir -p ~/.config/games4james && umask 077 && pbpaste > ~/.config/games4james/resend-api-key",
  );
}

async function resend(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    // A failure's message is a validation text; successful bodies can hold keys and are never printed.
    let reason = "";
    try {
      reason = `: ${String(JSON.parse(text)?.message ?? "").slice(0, 300)}`;
    } catch {
      // Not JSON.
    }
    throw new Error(
      `Resend ${method} ${route.replace(/[0-9a-f-]{36}/g, "<id>")}: HTTP ${res.status}${reason}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

function aws(args) {
  return JSON.parse(execFileSync("aws", [...args, "--output", "json"], { encoding: "utf8" }));
}

// ---------------------------------------------------------------------------
// Route 53
// ---------------------------------------------------------------------------

function hostedZoneId() {
  const zones = aws([
    "route53",
    "list-hosted-zones-by-name",
    "--dns-name",
    DOMAIN,
    "--max-items",
    "1",
  ]);
  const zone = zones.HostedZones?.[0];
  if (!zone || zone.Name !== `${DOMAIN}.`)
    fail(`No Route 53 hosted zone for ${DOMAIN} in this AWS account.`);
  return zone.Id.replace("/hostedzone/", "");
}

/** A Resend record as a Route 53 record set. TXT values are quoted in 255-character chunks. */
function toRecordSet(record) {
  const fqdn =
    !record.name || record.name === "@" || record.name === DOMAIN
      ? `${DOMAIN}.`
      : `${record.name.replace(new RegExp(`\\.?${DOMAIN.replace(/\./g, "\\.")}\\.?$`), "")}.${DOMAIN}.`;
  const value =
    record.type === "TXT"
      ? (record.value.match(/.{1,255}/g) ?? []).map((part) => `"${part}"`).join(" ")
      : record.type === "MX"
        ? `${record.priority ?? 10} ${record.value}`
        : record.value;
  return {
    Name: fqdn,
    Type: record.type,
    TTL: 300,
    ResourceRecords: [{ Value: value }],
  };
}

function existingRecordSet(zoneId, name, type) {
  const found = aws([
    "route53",
    "list-resource-record-sets",
    "--hosted-zone-id",
    zoneId,
    "--start-record-name",
    name,
    "--start-record-type",
    type,
    "--max-items",
    "1",
  ]);
  const set = found.ResourceRecordSets?.[0];
  return set && set.Name === name && set.Type === type ? set : null;
}

function writeDns(zoneId, records) {
  const changes = [];
  for (const record of records) {
    const wanted = toRecordSet(record);
    const existing = existingRecordSet(zoneId, wanted.Name, wanted.Type);
    const have = existing?.ResourceRecords?.map((r) => r.Value) ?? [];
    if (have.length === 1 && have[0] === wanted.ResourceRecords[0].Value) {
      console.log(`  ${wanted.Type} ${wanted.Name}: already there`);
      continue;
    }
    if (existing) {
      fail(
        `  ${wanted.Type} ${wanted.Name} already exists with a different value. Not touching it;\n` +
          "  merge it by hand in Route 53 (Resend's value is on the domain's page in Resend), then rerun.",
      );
    }
    console.log(`  ${wanted.Type} ${wanted.Name}: ${dryRun ? "would add" : "adding"}`);
    changes.push({ Action: "CREATE", ResourceRecordSet: wanted });
  }
  if (!changes.length || dryRun) return;
  const dir = mkdtempSync(path.join(os.tmpdir(), "g4j-dns-"));
  try {
    const batch = path.join(dir, "batch.json");
    writeFileSync(
      batch,
      JSON.stringify({ Comment: "Resend for Supabase Auth email (T14.9)", Changes: changes }),
    );
    const change = aws([
      "route53",
      "change-resource-record-sets",
      "--hosted-zone-id",
      zoneId,
      "--change-batch",
      `file://${batch}`,
    ]);
    execFileSync("aws", [
      "route53",
      "wait",
      "resource-record-sets-changed",
      "--id",
      change.ChangeInfo.Id,
    ]);
    console.log("  Route 53 has the records");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------

console.log(`Resend for ${DOMAIN} (sender ${FROM})${dryRun ? ", dry run" : ""}`);

if (!apiKey) {
  console.log(`
Without a Resend key this only describes the steps:
  1. add ${DOMAIN} to Resend (region ${REGION}) and read its DNS records
  2. add them to Route 53 (zone ${DOMAIN}), never replacing a different existing record
  3. verify the domain in Resend
  4. create a send-only key for Supabase in ${SMTP_KEY_FILE}
  5. run supabase-auth-setup.mjs with SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_ADMIN_EMAIL=${FROM}`);
  process.exit(0);
}

const zoneId = hostedZoneId();
console.log(`Route 53 zone found for ${DOMAIN}`);

const listed = await resend("GET", "/domains");
let domain = (listed?.data ?? []).find((d) => d.name === DOMAIN);
if (!domain) {
  if (dryRun) {
    console.log(
      `Would add ${DOMAIN} to Resend (${REGION}); its DNS records are known only after that.`,
    );
    process.exit(0);
  }
  domain = await resend("POST", "/domains", { name: DOMAIN, region: REGION });
  console.log(`Added ${DOMAIN} to Resend`);
}
domain = await resend("GET", `/domains/${domain.id}`);
console.log(`Resend domain status: ${domain.status}`);

console.log("DNS records:");
writeDns(zoneId, domain.records ?? []);

if (domain.status !== "verified") {
  if (dryRun) {
    console.log("Would ask Resend to verify and wait.");
  } else {
    await resend("POST", `/domains/${domain.id}/verify`);
    const deadline = Date.now() + 10 * 60 * 1000;
    process.stdout.write("Verifying");
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 15_000));
      domain = await resend("GET", `/domains/${domain.id}`);
      process.stdout.write(".");
      if (domain.status === "verified" || domain.status === "failed") break;
    }
    console.log(` ${domain.status}`);
    if (domain.status !== "verified") {
      fail(
        "Not verified yet (DNS can take a while). Rerun this script later; it picks up where it left off.",
      );
    }
  }
}

let smtpKey = existsSync(SMTP_KEY_FILE) ? readFileSync(SMTP_KEY_FILE, "utf8").trim() : null;
if (!smtpKey) {
  if (dryRun) {
    console.log(`Would create a send-only key for ${DOMAIN} → ${SMTP_KEY_FILE}`);
  } else {
    const created = await resend("POST", "/api-keys", {
      name: "supabase-auth-smtp",
      permission: "sending_access",
      domain_id: domain.id,
    });
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(SMTP_KEY_FILE, created.token, { mode: 0o600 });
    smtpKey = created.token;
    console.log(`Created a send-only key for Supabase (saved to ${SMTP_KEY_FILE})`);
  }
}

const smtpEnv = {
  SMTP_HOST: "smtp.resend.com",
  SMTP_PORT: "465",
  SMTP_USER: "resend",
  SMTP_PASS: smtpKey ?? "",
  SMTP_ADMIN_EMAIL: FROM,
};
const setup = path.join(ROOT, "scripts/supabase-auth-setup.mjs");
console.log(
  `\nSupabase: ${dryRun || !smtpKey ? "would run" : "running"} supabase-auth-setup.mjs with Resend's SMTP settings`,
);
if (dryRun || !smtpKey) process.exit(0);
const run = spawnSync(
  process.execPath,
  [setup, ...process.argv.slice(2).filter((a) => a !== "--dry-run")],
  {
    stdio: "inherit",
    env: { ...process.env, ...smtpEnv },
  },
);
process.exit(run.status ?? 1);
