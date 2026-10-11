#!/usr/bin/env node
/**
 * Configures Supabase Auth and wires local development to it (plan T14.0, T14.9).
 * See docs/supabase-auth-setup.md for what it sets and why.
 *
 *   node scripts/supabase-auth-setup.mjs --dry-run        # print what it would send, secrets masked
 *   node scripts/supabase-auth-setup.mjs                  # configure, write the .env.local files
 *   node scripts/supabase-auth-setup.mjs --only prod      # two-project mode: one of them
 *   node scripts/supabase-auth-setup.mjs --google         # also turn Google on (social sign-in)
 *   node scripts/supabase-auth-setup.mjs --env-dir <repo> # write .env.local files under another checkout
 *
 * Projects: `games4james` (production) is required. If a `games4james-dev` project exists
 * (or SUPABASE_DEV_REF is set), local development signs in there; until then local
 * development shares the production project, whose redirect list then also allows
 * localhost. Refs can be forced with SUPABASE_PROD_REF / SUPABASE_DEV_REF.
 *
 * The personal access token comes from SUPABASE_ACCESS_TOKEN, or from the file named by
 * SUPABASE_ACCESS_TOKEN_FILE (default ~/.config/games4james/supabase-access-token).
 * --google reads GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET; a custom mail
 * server is used when SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_ADMIN_EMAIL are set.
 *
 * Every change is a PATCH of named fields (a partial update): settings it doesn't name
 * stay as they are. Never `supabase config push`, which resets undeclared settings.
 * Nothing secret is printed; keys go straight into the gitignored .env.local files.
 */
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setEnv } from "./lib/set-env.mjs";

const API = "https://api.supabase.com/v1";
const ROOT = path.resolve(import.meta.dirname, "..");
const brand = JSON.parse(
  readFileSync(path.join(ROOT, "apps/player-web/src/config/brand.json"), "utf8"),
);
const APP_SCHEME_CALLBACK = "com.games4james.app://auth/callback";
const CODE_MINUTES = 15;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => (flag(name) ? args[args.indexOf(name) + 1] : null);
const dryRun = flag("--dry-run");
const google = flag("--google");
const only = option("--only");
if (only && only !== "dev" && only !== "prod") fail("--only takes dev or prod");
const envDir = path.resolve(option("--env-dir") ?? ROOT);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const mask = (value) => (value ? `***(${String(value).length} chars)` : value);

const DEV = {
  name: "games4james-dev",
  refVar: "SUPABASE_DEV_REF",
  siteUrl: "http://localhost:3000",
  redirects: [
    "http://localhost:3000/auth/callback", // player web (lib/supabase.ts CALLBACK_PATH)
    "http://localhost:3100/", // admin (redirectTo origin + "/")
  ],
};
const PROD = {
  name: "games4james",
  refVar: "SUPABASE_PROD_REF",
  siteUrl: brand.origin,
  redirects: [`${brand.origin}/auth/callback`, "https://admin.games4james.com/"],
};

// ---------------------------------------------------------------------------
// Emails: a 6-digit code, no links (works across devices, nothing to redirect)
// ---------------------------------------------------------------------------

function codeEmail(heading, line) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#2b2118">
<h2 style="color:#d23a2e">${brand.name}</h2>
<p>${heading}</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:24px 0">{{ .Token }}</p>
<p>${line} It works for ${CODE_MINUTES} minutes.</p>
<p style="color:#6b5e52;font-size:13px">If you didn't ask for this, you can ignore this email. Nobody can get in without the code.</p>
</div>`;
}

const EMAIL_SETTINGS = {
  // The email provider also carries the PIN accounts' sign-in (generateLink + verifyOtp).
  external_email_enabled: true,
  // "Confirm email" on: an outside password sign-up never gets a session.
  mailer_autoconfirm: false,
  mailer_otp_length: 6,
  mailer_otp_exp: CODE_MINUTES * 60,
  // A PIN account's old address is the synthetic <username>@pin.games4james.com, which
  // can't receive mail: confirm the new address only, and send no "email changed" notice.
  mailer_secure_email_change_enabled: false,
  mailer_notifications_email_changed_enabled: false,
};

/**
 * Code-only emails. Supabase only lets a project change its templates once it sends
 * through its own mail server (custom SMTP); with the built-in sender the defaults stay,
 * and they carry a link instead of the code.
 */
const EMAIL_TEMPLATES = {
  mailer_subjects_magic_link: `Your ${brand.name} sign-in code`,
  mailer_templates_magic_link_content: codeEmail(
    `Here is your code to sign in to ${brand.name}:`,
    "Type it on the sign-in page.",
  ),
  mailer_subjects_email_change: `Confirm your email for ${brand.name}`,
  mailer_templates_email_change_content: codeEmail(
    `Someone added this email to a ${brand.name} account. If that was you, here is the code:`,
    "Type it in Settings to confirm.",
  ),
};

function smtpSettings() {
  const env = process.env;
  if (!env.SMTP_HOST) return null;
  const needed = ["SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_ADMIN_EMAIL"].filter((k) => !env[k]);
  if (needed.length) fail(`SMTP_HOST is set but these are missing: ${needed.join(", ")}`);
  return {
    smtp_host: env.SMTP_HOST,
    smtp_port: env.SMTP_PORT,
    smtp_user: env.SMTP_USER,
    smtp_pass: env.SMTP_PASS,
    smtp_admin_email: env.SMTP_ADMIN_EMAIL,
    smtp_sender_name: brand.name,
    // The built-in sender's limit is 2 an hour; with our own server, room for a family evening.
    rate_limit_email_sent: 30,
  };
}

/** The auth settings for a project. Secrets are masked in --dry-run output only. */
function authConfig(project, redirects) {
  const body = {
    site_url: project.siteUrl,
    uri_allow_list: [...redirects, APP_SCHEME_CALLBACK].join(","),
    // Guests: anonymous users, upgraded in place (PIN via the admin API, Google/Apple by linking).
    external_anonymous_users_enabled: true,
    security_manual_linking_enabled: true,
    // Sign-ups stay open: turning them off would block anonymous sign-ins too.
    disable_signup: false,
    ...EMAIL_SETTINGS,
    ...(smtpSettings() ? { ...smtpSettings(), ...EMAIL_TEMPLATES } : {}),
    external_google_enabled: google,
  };
  if (google) {
    body.external_google_client_id = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
    body.external_google_secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
    if (!dryRun && (!body.external_google_client_id || !body.external_google_secret)) {
      fail(
        "--google needs GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in the environment",
      );
    }
  }
  return body;
}

function printable(body) {
  const shown = { ...body };
  for (const key of ["external_google_secret", "smtp_pass"]) {
    if (shown[key] !== undefined) shown[key] = mask(shown[key]);
  }
  for (const key of Object.keys(shown)) {
    if (key.startsWith("mailer_templates_")) shown[key] = `<${shown[key].length} chars of HTML>`;
  }
  return JSON.stringify(shown, null, 2).replace(/^/gm, "    ");
}

// ---------------------------------------------------------------------------
// Management API
// ---------------------------------------------------------------------------

function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  const file =
    process.env.SUPABASE_ACCESS_TOKEN_FILE ??
    path.join(os.homedir(), ".config/games4james/supabase-access-token");
  return existsSync(file) ? readFileSync(file, "utf8").trim() || null : null;
}

const token = readToken();
if (token?.startsWith("sb_")) {
  fail(
    "That is a project API key (sb_…), not a personal access token. Create one under\n" +
      "Supabase → Account → Access tokens (it starts with sbp_) and save that instead.",
  );
}
if (!token && !dryRun) {
  fail(
    "No access token. Supabase → Account → Access tokens, then save it (outside the repo) to\n" +
      "~/.config/games4james/supabase-access-token, or export SUPABASE_ACCESS_TOKEN.",
  );
}

async function api(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  // Never echo a successful body: it can hold keys. A failure's `message` is a validation
  // text, so it is shown (shortened) to say what went wrong.
  if (!res.ok) {
    let reason = "";
    try {
      const message = JSON.parse(text)?.message;
      if (typeof message === "string") reason = `: ${message.slice(0, 300)}`;
    } catch {
      // Not JSON: status only.
    }
    throw new Error(
      `${method} ${route.replace(/\/projects\/[a-z]+/, "/projects/<ref>")}: HTTP ${res.status}${reason}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

/** { prod, dev }: dev is null while local development shares the production project. */
async function findRefs() {
  if (!token) {
    return {
      prod: process.env.SUPABASE_PROD_REF || "<prod-ref>",
      dev: process.env.SUPABASE_DEV_REF || null,
    };
  }
  const listed =
    process.env.SUPABASE_PROD_REF && process.env.SUPABASE_DEV_REF
      ? []
      : await api("GET", "/projects");
  const refOf = (p) => {
    const found = listed.find((x) => x.name === p.name);
    return process.env[p.refVar] || found?.ref || found?.id || null;
  };
  const prod = refOf(PROD);
  if (!prod)
    fail(`No Supabase project named ${PROD.name}. Set ${PROD.refVar} if it has another name.`);
  return { prod, dev: refOf(DEV) };
}

/** Moves the project to an ES256 signing key, once. Returns a line for the summary. */
async function ensureEs256(ref) {
  const route = `/projects/${ref}/config/auth/signing-keys`;
  if (dryRun) {
    console.log(`  POST ${route}/legacy (import the legacy secret, if not done)`);
    console.log(
      `  POST ${route} {"algorithm":"ES256"} then PATCH ${route}/<id> {"status":"in_use"}`,
    );
    return "ES256 key: would be created and made current";
  }
  const listed = await api("GET", route);
  const keys = Array.isArray(listed) ? listed : (listed?.keys ?? []);
  if (keys.some((k) => k.algorithm === "ES256" && k.status === "in_use")) {
    return "ES256 key: already current";
  }
  try {
    await api("GET", `${route}/legacy`);
  } catch {
    await api("POST", `${route}/legacy`); // the old shared secret becomes a signing key first
  }
  const standby =
    keys.find((k) => k.algorithm === "ES256" && k.status === "standby") ??
    (await api("POST", route, { algorithm: "ES256" }));
  await api("PATCH", `${route}/${standby.id}`, { status: "in_use" });
  return "ES256 key: created and made current";
}

async function apiKeys(ref) {
  const keys = await api("GET", `/projects/${ref}/api-keys?reveal=true`);
  const find = (type) => keys.find((k) => k.type === type && k.api_key)?.api_key;
  const create = async (type, name) =>
    (await api("POST", `/projects/${ref}/api-keys?reveal=true`, { type, name })).api_key;
  const publishable = find("publishable") ?? (await create("publishable", "default"));
  const secret = find("secret") ?? (await create("secret", "backend_api"));
  if (!publishable || !secret) throw new Error("could not read the project's API keys");
  return { publishable, secret };
}

async function configure(project, ref, redirects) {
  const body = authConfig(project, redirects);
  console.log(`\n${project.name}`);
  if (dryRun) {
    console.log(`  PATCH /projects/${ref}/config/auth`);
    console.log(printable(body));
  } else {
    await api("PATCH", `/projects/${ref}/config/auth`, body);
    console.log("  auth settings updated");
  }
  let signing;
  try {
    signing = await ensureEs256(ref);
  } catch (err) {
    signing = `ES256 key: not done (${err.message}); do it by hand: Settings → JWT Keys`;
  }
  console.log(`  ${signing}`);
}

/** The keys local development uses, written into the three gitignored .env.local files. */
async function writeLocalEnv(project, ref) {
  const url = `https://${ref}.supabase.co`;
  const files = {
    player: path.join(envDir, "apps/player-web/.env.local"),
    admin: path.join(envDir, "apps/admin-web/.env.local"),
    api: path.join(envDir, "apps/backend-api/.env.local"),
  };
  if (dryRun) {
    console.log(
      `  would write ${project.name}'s VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY → ${files.player}, ${files.admin}`,
    );
    console.log(`  would write SUPABASE_URL, SUPABASE_SECRET_KEY → ${files.api}`);
    return;
  }
  const { publishable, secret } = await apiKeys(ref);
  const web = { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishable };
  setEnv(files.player, web);
  setEnv(files.admin, web);
  setEnv(files.api, { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret });
}

// ---------------------------------------------------------------------------

const refs = await findRefs();
const shared = !refs.dev;
if (shared && only === "dev")
  fail(`No ${DEV.name} project yet: local development uses ${PROD.name}.`);

if (shared) {
  console.log(
    `No ${DEV.name} project: local development shares ${PROD.name} (its redirect list also allows localhost).`,
  );
  await configure(PROD, refs.prod, [...PROD.redirects, ...DEV.redirects]);
  await writeLocalEnv(PROD, refs.prod);
} else {
  if (only !== "dev") await configure(PROD, refs.prod, PROD.redirects);
  if (only !== "prod") {
    await configure(DEV, refs.dev, DEV.redirects);
    await writeLocalEnv(DEV, refs.dev);
  }
}

const prodUrl = `https://${refs.prod}.supabase.co`;
console.log(`\n${dryRun ? "Dry run: nothing was changed." : "Done."}`);
if (!smtpSettings()) {
  console.log(
    "Email: no mail server yet, so Supabase's built-in sender is used. It only delivers to this\n" +
      "project's team members, a few an hour, and its emails keep Supabase's default templates\n" +
      "(a link, not the 6-digit code our screens ask for). Set SMTP_* and rerun to fix both\n" +
      '(docs/supabase-auth-setup.md, "Email delivery").',
  );
}
console.log(
  `GitHub (at relaunch): variables VITE_SUPABASE_URL=${prodUrl}, SUPABASE_URL=${prodUrl}, VITE_SUPABASE_PUBLISHABLE_KEY; secret SUPABASE_SECRET_KEY.`,
);
console.log(`Check: curl -s ${prodUrl}/auth/v1/.well-known/jwks.json lists an ES256 key.`);
