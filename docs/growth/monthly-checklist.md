# Monthly growth checklist (T11.10)

About an hour, once a month. Claude can do the starred items when asked: "do the monthly growth check".

1. ★ **Look at the numbers.** Cloudflare Web Analytics: visits, top pages, referrers. Admin dashboard: plays per day, active players, top games, plays per game. Note the trend in `docs/money.md` next to costs.
2. ★ **Drop-off.** For each game, look at plays per player and how many players came back for a second run within a day. A game with many one-play players needs a look: too hard at the start, or unclear controls?
3. **One devlog short.** A kid's drawing becomes a sprite becomes a game. Thirty seconds, vertical, no faces needed. Post where the family is comfortable.
4. ★ **Listings.** Update itch.io and the Phaser showcase with any new game ([listings.md](listings.md)).
5. ★ **Search Console.** Are new game pages indexed? Any errors? Is `sitemap.xml` fresh?
6. **Ask the family.** Which game next? Write the idea in `docs/plan/backlog-inactive-games.md` or as a T11.8 entry.
7. ★ **Housekeeping.** Run `npm run deps:check`, triage Dependabot PRs, run the backup restore test once a quarter ([runbooks/database-backup.md](../runbooks/database-backup.md)).
