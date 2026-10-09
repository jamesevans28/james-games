// Run: node --test "infra/**/*.test.mjs" (part of the root npm test)
// CloudFront Functions are plain scripts with a global handler(), so load the
// file into a sandbox exactly as CloudFront would.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("./bot-rewrite.js", import.meta.url), "utf8");
const sandbox = {};
vm.runInNewContext(source, sandbox);

const run = (uri, ua) =>
  sandbox.handler({ request: { uri, headers: ua ? { "user-agent": { value: ua } } : {} } }).uri;

test("bots asking for a game page get the static page", () => {
  for (const ua of [
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0",
    "Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ]) {
    assert.equal(run("/games/snapadile", ua), "/static-games/snapadile.html", ua);
  }
  assert.equal(run("/games/hoop-city/", "Twitterbot/1.0"), "/static-games/hoop-city.html");
});

test("people always get the app", () => {
  const safari =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  assert.equal(run("/games/snapadile", safari), "/games/snapadile");
  assert.equal(run("/games/snapadile", undefined), "/games/snapadile");
});

test("only single game pages are rewritten", () => {
  const bot = "Twitterbot/1.0";
  assert.equal(run("/", bot), "/");
  assert.equal(run("/games-list", bot), "/games-list");
  assert.equal(run("/games/snapadile/extra", bot), "/games/snapadile/extra");
  assert.equal(run("/games/../secret", bot), "/games/../secret");
  assert.equal(run("/leaderboard/snapadile", bot), "/leaderboard/snapadile");
});

test("share links are left alone (their /s/* behaviour goes to the API)", () => {
  const id = "3f2b8c1e-7a4d-4c6b-9e2f-1a2b3c4d5e6f";
  assert.equal(run(`/s/${id}`, "WhatsApp/2.23.20.0"), `/s/${id}`);
  assert.equal(run(`/s/${id}.png`, "Twitterbot/1.0"), `/s/${id}.png`);
});
