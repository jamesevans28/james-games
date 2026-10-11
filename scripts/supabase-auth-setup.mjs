#!/usr/bin/env node
/**
 * Configures Supabase Auth on both projects and wires local development to the dev
 * one (plan T14.0). See docs/supabase-auth-setup.md for what it sets and why.
 *
 *   node scripts/supabase-auth-setup.mjs --dry-run     # print what it would send, secrets masked
 *   node scripts/supabase-auth-setup.mjs               # both projects; .env.local files from dev
 *   node scripts/supabase-auth-setup.mjs --only dev    # or --only prod
 *   node scripts/supabase-auth-setup.mjs --google      # also turn Google on (social sign-in)
 *
 * Needs SUPABASE_ACCESS_TOKEN (a personal access token, exported in this terminal only).
 * Projects are found by name (games4james, games4james-dev) unless SUPABASE_PROD_REF /
 * SUPABASE_DEV_REF are set. --google reads GOOGLE_OAUTH_CLIENT_ID and
 * GOOGLE_OAUTH_CLIENT_SECRET from the environment.
 *
 * Every change is a PATCH of named fields (a partial update): settings it doesn't name
 * stay as they are. Never `supabase config push`, which resets undeclared settings.
 * Nothing secret is printed; keys go straight into the gitignored .env.local files, and
 * production keys are never written to disk (the script prints the GitHub names instead).
 */
import path from "node:path";
import { setEnv } from "./lib/set-env.mjs";

const API = "https://api.supabase.com/v1";
const ROOT = path.resolve(import.meta.dirname, "..");
const APP_SCHEME_CALLBACK = "com.games4james.app://auth/callback";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const google = args.includes("--google");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
if (only && only !== "dev" && only !== "prod") fail("--only takes dev or prod");

/** The two projects. Redirect URLs must match what the apps pass as `redirectTo`. */
const PROJECTS = [
  {
    env: "dev",
    name: "games4james-dev",
    refVar: "SUPABASE_DEV_REF",
    siteUrl: "http://localhost:3000",
    redirects: [
      "http://localhost:3000/auth/callback", // player web (lib/supabase.ts CALLBACK_PATH)
      "http://localhost:3100/", // admin (redirectTo origin + "/")
      APP_SCHEME_CALLBACK,
    ],
  },
  {
    env: "prod",
    name: "games4james",
    refVar: "SUPABASE_PROD_REF",
    siteUrl: "https://games4james.com",
    redirects: [
      "https://games4james.com/auth/callback",
      "https://admin.games4james.com/",
      APP_SCHEME_CALLBACK,
    ],
  },
].filter((p) => !only || p.env === only);

function fail(message) {
  console.error(message);
  process.exit(1);
}

const mask = (value) => (value ? `***(${String(value).length} chars)` : value);

/** The auth settings for a project. Secrets are masked in --dry-run output only. */
function authConfig(project) {
  const body = {
    site_url: project.siteUrl,
    uri_allow_list: project.redirects.join(","),
    // Guests: anonymous users, upgraded in place (PIN via the admin API, Google/Apple by linking).
    external_anonymous_users_enabled: true,
    security_manual_linking_enabled: true,
    // Sign-ups stay open: turning them off would block anonymous sign-ins too.
    disable_signup: false,
    // The email provider carries the PIN accounts' magic-link exchange, so it stays on;
    // "Confirm email" stays on so an outside password sign-up never gets a session.
    external_email_enabled: true,
    mailer_autoconfirm: false,
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

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token && !dryRun)
  fail("Export SUPABASE_ACCESS_TOKEN first (Supabase → Account → Access tokens).");

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
  // Never echo a response body: it can hold keys.
  if (!res.ok)
    throw new Error(
      `${method} ${route.replace(/\/projects\/[a-z]+/, "/projects/<ref>")}: HTTP ${res.status}`,
    );
  return text ? JSON.parse(text) : null;
}

async function findRefs() {
  if (!token)
    return Object.fromEntries(
      PROJECTS.map((p) => [p.env, process.env[p.refVar] || `<${p.env}-ref>`]),
    );
  const missing = PROJECTS.filter((p) => !process.env[p.refVar]);
  const listed = missing.length ? await api("GET", "/projects") : [];
  const refs = {};
  for (const p of PROJECTS) {
    const ref =
      process.env[p.refVar] ||
      listed.find((x) => x.name === p.name)?.ref ||
      listed.find((x) => x.name === p.name)?.id;
    if (!ref)
      fail(
        `No Supabase project named ${p.name}. Create it (docs/supabase-auth-setup.md) or set ${p.refVar}.`,
      );
    refs[p.env] = ref;
  }
  return refs;
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
  if (keys.some((k) => k.algorithm === "ES256" && k.status === "in_use"))
    return "ES256 key: already current";
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
  let publishable = find("publishable");
  let secret = find("secret");
  if (!publishable)
    publishable = (
      await api("POST", `/projects/${ref}/api-keys?reveal=true`, {
        type: "publishable",
        name: "default",
      })
    ).api_key;
  if (!secret)
    secret = (
      await api("POST", `/projects/${ref}/api-keys?reveal=true`, {
        type: "secret",
        name: "backend_api",
      })
    ).api_key;
  if (!publishable || !secret) throw new Error("could not read the project's API keys");
  return { publishable, secret };
}

const refs = await findRefs();
const summary = [];
for (const project of PROJECTS) {
  const ref = refs[project.env];
  const body = authConfig(project);
  console.log(`\n${project.name} (${project.env})`);
  if (dryRun) {
    const shown = { ...body };
    if (shown.external_google_secret !== undefined)
      shown.external_google_secret = mask(shown.external_google_secret);
    console.log(`  PATCH /projects/${ref}/config/auth`);
    console.log(JSON.stringify(shown, null, 2).replace(/^/gm, "    "));
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

  const url = `https://${ref}.supabase.co`;
  if (project.env === "dev") {
    const files = {
      player: path.join(ROOT, "apps/player-web/.env.local"),
      admin: path.join(ROOT, "apps/admin-web/.env.local"),
      api: path.join(ROOT, "apps/backend-api/.env.local"),
    };
    if (dryRun) {
      console.log(
        `  would write VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY → ${path.relative(ROOT, files.player)}, ${path.relative(ROOT, files.admin)}`,
      );
      console.log(
        `  would write SUPABASE_URL, SUPABASE_SECRET_KEY → ${path.relative(ROOT, files.api)}`,
      );
    } else {
      const { publishable, secret } = await apiKeys(ref);
      const web = { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publishable };
      setEnv(files.player, web);
      setEnv(files.admin, web);
      setEnv(files.api, { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret });
    }
  } else {
    summary.push(
      "Production keys are not written anywhere. Set these in GitHub (Settings → Secrets and variables → Actions), values from the games4james project's Settings → API Keys:",
      `  variables: VITE_SUPABASE_URL=${url}, VITE_SUPABASE_PUBLISHABLE_KEY (the publishable key), SUPABASE_URL=${url}`,
      "  secret:    SUPABASE_SECRET_KEY (a secret key)",
    );
  }
}

console.log(`\n${dryRun ? "Dry run: nothing was changed." : "Done."}`);
if (summary.length) console.log(summary.join("\n"));
console.log(
  `Check: curl -s https://<dev-ref>.supabase.co/auth/v1/.well-known/jwks.json lists an ES256 key.`,
);
