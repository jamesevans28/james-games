# Phase 11: Features and growth (ongoing)

Features that put the kids at the front and give players a reason to come back. Pick in order; each is one or two sessions. New games follow the new-game checklist (T4.9) and the art README (T8.9).

## T11.1 Credits and designer's notes everywhere

Status: done in code 2026-10-09; the notes are Claude's drafts (`// TODO note` comments) until James writes the real ones with Tilly and Harvey (ON-RETURN)
Depends on: T3.3, T4.8
Steps: every manifest gets `makers` and a `note` written in the family voice (James writes the real ones with Tilly and Harvey; Claude drafts placeholders marked `TODO note`); landing page shows "Made by …" and the note in the handwriting font; the About page lists all games by maker.
Done when: all 11 active manifests have real notes (no `TODO note`).

## T11.2 Remix mode

Status: done 2026-10-09
Depends on: T4.3 (`remix` knobs in manifests), T6.3
Steps:

1. Manifest `remix: RemixKnob[]` (`{ key, label, min, max, step, default }`), e.g. Snapadile: spawn speed, lives, croc size; Hoop City: gravity, ring gap; Blocker: tray size.
2. Landing page "Remix" button → sliders → "Play this remix" → `host.remix` values passed to `create()`; the scene reads `host.remix.get("gravity")`.
3. "Save remix": `remixes` table (id, owner, game_id, name, knobs jsonb, created_at); a remix has its own leaderboard (plays.remix_id); shareable link `/games/:id?remix=<id>`.
4. Server validates knob ranges against the manifest export.
   Done when: Tilly can make "Tilly's super-fast crocs", save it, and Harvey can beat her score on it.

## T11.3 Daily challenge

Status: done 2026-10-09
Depends on: T4.4 (`host.rng`), T6.3
Steps: `/daily` page: one game per day (rotation seeded by date), one seeded run per player per day (`rng(dateSeed)`), a daily leaderboard, a sticker for playing 3 dailies in a week. Server stores `daily_runs` (user_id, day, game_id, score).
Done when: two players get the same spawn sequence on the same day; the daily board resets at midnight local.

## T11.4 Stickers (achievements)

Status: done in code 2026-10-09; check the sticker book and the game-over sticker moment in the Browser pane
Depends on: T8.6, T7.5
Steps: `stickers` table (user_id, sticker_id, earned_at); rules evaluated in the submission transaction (first play, first best, 5 games tried, 3 days this week, 100 in Reflex Ring, …) from a declarative list in `src/config/stickers.ts` mirrored in the backend; "You got a sticker!" moment uses the overlay queue (T7.11); profile sticker book.
Done when: tests for the rule evaluator; stickers appear in the profile.

## T11.5 Share cards

Status: done in code 2026-10-09; James adds the `/s/*` CloudFront behaviour (infra/cloudfront/README.md), then checks a WhatsApp preview
Depends on: T3.4 (bot rewrite), T6.3
Steps: `/s/:playId` returns a prerendered page with an OG image generated on the fly by a tiny Lambda (`@vercel/og`-style satori → PNG, or a pre-rendered template with text overlay via `sharp`) showing cover, score, maker credit and "Can you beat it?"; the share button on game over uses `ShareAdapter` with that link. Cache images in S3 (free tier).
Done when: sharing a score to WhatsApp shows the card with the score.

## T11.6 Pass-and-play

Status: done in code 2026-10-09; two-round flow to check in the Browser pane
Depends on: T4.4
Steps: landing toggle "2 players"; names entered locally; the host runs two consecutive `restart()` runs and shows a comparison screen; no server changes (optional: record both as plays under the signed-in user with a `local_player` tag).
Done when: two rounds alternate and a winner screen shows.

## T11.7 Parent dashboard (light)

Status: done in code 2026-10-09; linking two local accounts and the play-time view to check in the Browser pane
Depends on: T7.8, T6.3
Steps: a PIN-protected parent view in settings: play time per day for linked kid accounts (family group table), toggle social, reset PIN, delete account. Family linking via a parent code.
Done when: James can see Tilly's and Harvey's play time for the week.

## T11.8 New games (one per month)

Status: todo
Depends on: T4.9, T8.9
Order of ideas from the review: Stack Tower (built in T4.9 as the SDK example, status `beta`; it needs Harvey's note, a real cover and SFX to go `active`), Bubble Pop Rescue (Snapadile skeleton; Tilly's animals), Bounce Up (input kit), Colour Sort (puzzle), Draw-a-Path Kart (Box Cutter grid). Each ships as `beta`, then `active` after the family plays it for a week.
Done when: a new `active` game exists with cover, note, SFX, tests and a share card.

## T11.9 Reactivate reworked games

Status: todo
Depends on: `docs/plan/backlog-inactive-games.md`
Steps: pick from the backlog when a rework is wanted; follow the migration recipe from Phase 5; flip `status` to `beta` then `active`.

## T11.10 Growth loop checklist (recurring)

Status: set up 2026-10-09 (docs/growth/monthly-checklist.md and listings.md); recurring from relaunch
Steps each month: review analytics (replays per game, drop-off at game over), post one devlog short (kid drawing → sprite → game), update the itch.io and Phaser showcase listings (create them once: `docs/growth/listings.md`), check Search Console for the new game pages, ask the family which game to make next.

## T11.11 Games4[YourName] template (future)

Status: todo (idea; decide after six months of use)
Goal: let another family fork the repo, set `brand.ts`, drop their games in, and deploy with the same pipeline. Everything in Phases 0–9 moves toward this; no extra work until it's wanted.
