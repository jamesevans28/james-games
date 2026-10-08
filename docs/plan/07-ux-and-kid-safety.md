# Phase 7: UX and kid safety

Make the app pleasant for a six-year-old and defensible to a parent. Everything here is required before the App Store Kids-category submission in Phase 10.

## T7.1 Home becomes the grid; the feed goes

Status: todo
Depends on: T3.1, T4.8
Files: `pages/home/HomeFeed.tsx`, `pages/games-list/index.tsx`, `components/feed/GameTile.tsx`, `hooks/useFeedAlgorithmV2.ts`, `App.tsx`
Steps:

1. Route `/` renders the grid (big square covers, title, "Your best", makers line). Sections: "New", "Play again" (recently played), "All games". No infinite loop, no rotating hooks.
2. Delete `useFeedAlgorithmV2`'s cycling; keep its ordering helper as a pure function with a test (recently played first, then updated_at).
3. Covers rendered with the Phase 8 template ratio (1:1) using `object-contain`; never crop.
4. Remove `/games-list` (redirect to `/`).
   Done when: the grid renders 11 active games in two columns at 375 px with no horizontal scroll; Lighthouse performance ≥ 90 on mobile.

## T7.2 Game landing simplification

Status: todo
Depends on: T7.1
Files: `pages/games/GameLanding.tsx`
Steps: order: cover, title + makers + designer's note, big Play, "How to play" (controls + objective from the manifest, always visible), your best / top 5, rating stars (only after 3 plays), nothing else. Remove created/updated dates and the "Following now" strip (presence becomes opt-in in T7.6). Split into `useGameRatings`, `useLeaderboard` (TanStack Query, T7.10) and small components.
Done when: file under 250 lines; landing renders with the API offline (graceful empties).

## T7.3 Game over that motivates

Status: todo
Depends on: T1.10, T4.4
Files: `pages/games/GameOver.tsx` → split into `GameOverDialog`, `XpBar`, `LevelUpBurst`, `useRunSubmission`
Steps: show score, "New best!" with confetti (CSS, reduced-motion aware) when beaten, previous best otherwise; XP bar from the submission response; "Play again" is the primary button and restarts via the host immediately; no rating prompt here, no sign-in nag (one small "Save your progress" link for guests, shown at most once per day).
Done when: Play Again is one tap with no intermediate dialog; guests see the nag at most once per day (test the pure `shouldShowSaveNudge` helper).

## T7.4 Rating prompt timing

Status: todo
Depends on: T7.3
Files: `components/RatingPromptModal.tsx`, `pages/games/PlayGame.tsx` rating state machine → `hooks/useRatingPrompt.ts`
Steps: prompt only on the landing page after the 3rd play of that game and at most once per game per 30 days; never on Play Again or Close. Pure helper with tests.
Done when: tests pass; the prompt never appears during a replay loop in the Browser pane.

## T7.5 Streaks become stickers

Status: todo
Depends on: T6.3
Files: `components/StreakCelebration.tsx`, backend `streakService.ts`
Steps: keep the daily streak count internally; replace the celebration with a weekly "sticker" (collected when you play on 3 different days in a week); remove loss-framed copy and the "LEGENDARY 365 days" ladder; show stickers on the profile. (Sticker art from Phase 8.)
Done when: no copy mentions losing a streak; `StreakCelebration.tsx` is under 150 lines (icons moved to the sticker set).

## T7.6 Friends-only social, presence opt-in

Status: todo
Depends on: T6.3
Files: `followersService.ts`, `followersController.ts`, `pages/followers/index.tsx`, `hooks/usePresenceReporter.ts`, `pages/profile/[userId].tsx`, settings
Steps:

1. Follow becomes a friend request (`status: pending`) that the other side accepts. A 6-character "friend code" (from `shareProfileLink.ts`) is the only way to find someone; no search by name.
2. Presence reporting is off unless `prefs.sharePresence` is true (settings toggle, default off). Friends see "online" only.
3. Profiles show only screen name, avatar, level and stickers; no follower lists, no last-seen.
4. Block: hides a user both ways and cancels the friendship.
   Done when: service tests for request/accept/block; no public endpoint lists followers.

## T7.7 Auth and PIN hardening in the UI

Status: todo
Depends on: T1.1, T6.3
Files: `pages/firebase-login.tsx`, backend `firebaseAuthService.ts` rate limiting
Steps: 6-digit PIN minimum for new accounts (existing 4-digit allowed until changed, with a nudge); server-side throttling stored in Postgres (per user and per IP, sliding window); lockout messages that don't reveal whether a username exists; "Forgot PIN" goes to the parent page instructions (James resets from admin).
Done when: tests for the throttle; brute-force script against local server gets 429 after N attempts across cold starts (restart the server mid-test).

## T7.8 Privacy, parent and about pages

Status: todo
Depends on: T3.3
Files: `pages/about.tsx`, `pages/privacy.tsx`, `pages/parents.tsx` (new), footer/drawer links
Steps:

1. About: who makes it (James, Tilly, Harvey), what it is, that it's free with no ads.
2. Privacy: exactly what is stored (uid, screen name, avatar, scores, optional email for sign-in, friend codes), what isn't (no ads, no selling, no tracking across sites), analytics statement (per T7.9), how to delete an account (settings → delete, or email), contact. Plain language, short.
3. Parents: how accounts work (anonymous by default, PIN accounts, Google/Apple), how to turn off social, how to delete, how to report a name.
4. Account deletion: `DELETE /me` removes the user and anonymises plays (keeps scores under "Deleted player"); settings button with a confirmation step.
   Done when: pages exist and are linked from the drawer and the login page; deletion works end-to-end locally.

## T7.9 Analytics decision and implementation

Status: todo
Depends on: T3.1
Steps: choose between (a) GA4 with `allow_google_signals: false`, `allow_ad_personalization_signals: false`, IP anonymisation (default in GA4) and consent-free config, or (b) Cloudflare Web Analytics (free, cookieless, no personal data; needs the site proxied through Cloudflare or the JS snippet with a token). Pick (b) if James is willing to add the snippet; otherwise (a). Load via `brand.analyticsId`, never inline in `index.html`. Record in `DECISIONS.md`.
Done when: the chosen tool reports page views and the `game_start`/`game_over` events; no third-party cookies are set (check in the Browser pane).

## T7.10 Server-state layer

Status: todo
Depends on: T7.2
Steps: `@tanstack/react-query` for games config, leaderboards, ratings, friends, stickers, profile; a single `ApiError`; invalidate on submission; remove the hand-rolled caches (`GameLanding` module map, `ratingCache.ts`, catalog cache) and the three polling loops.
Done when: no `setInterval` polling remains in `src/`; `npm run lint` clean; network tab shows one request per resource per screen.

## T7.11 Overlay discipline and install prompts

Status: todo
Depends on: T7.1
Steps: at most one overlay at a time, in priority order (update → paused game → sticker → install hint); install hint only after the 2nd visit; iOS hint only on iOS Safari and not in standalone mode; all dismissals remembered for 14 days (`g4j:dismiss:<id>`).
Done when: first visit in the Browser pane shows zero overlays; second visit shows only the install hint.

## T7.12 Accessibility pass

Status: todo
Depends on: T7.1
Steps: minimum 44 px tap targets; body text ≥ 16 px; colour contrast ≥ 4.5:1 on paper for ink-2; `prefers-reduced-motion` respected in all CSS and Phaser tweens (via host flag); every icon button has an `aria-label`; Flash Bash and Cosmic Clash readable without colour.
Done when: axe DevTools (or Lighthouse accessibility) ≥ 95 on home, landing, settings.
