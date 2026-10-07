# Games4James — AI assistant instructions

Games4James is a mobile-first web platform of small Phaser games made by James with Tilly and Harvey.
This monorepo has three npm workspaces: `apps/player-web` (React + Vite + Phaser PWA), `apps/backend-api`
(Express on AWS Lambda) and `apps/admin-web` (moderation console).

**Read `CLAUDE.md` and `docs/plan/README.md` before making changes.** The plan in `docs/plan/` is the
source of truth for what to build next; `docs/plan/DECISIONS.md` lists decisions that are already made.

Non-negotiables:

1. **Mobile first.** Portrait, touch first, 540×960 design resolution, steady 60 fps.
2. **Games are plugins.** Each game lives in `apps/player-web/src/games/<id>/`; shared code goes in
   `src/platform/` or `src/game/`, never copied between games.
3. **The server never trusts the client** for scores, XP, dates or multipliers.
4. **No PII in logs.** Never log emails, usernames, user ids or raw auth-library error objects.

Auth is Firebase: the client sends a Firebase ID token as a bearer token. There are no auth cookies.
