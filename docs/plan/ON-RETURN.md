# On your return: questions and actions for James

Claude kept this list while working through the phases unattended (started 9 Oct 2026). Newest items go at the bottom of each section. Tick them off or answer inline; Claude reads this file at the start of the next session.

## Actions only you can do (in order)

1. **Node 24.** Install it (`nvm install 24`), so `npm` commands run without the `npx -p node@24` wrapper.
2. **T6.0 Firebase project.** Run `firebase login` and `gcloud auth login`, then `scripts/firebase-setup.sh`. After that, enable Google sign-in and brand the consent screen ([docs/firebase-auth-setup.md](../firebase-auth-setup.md)).
3. **T6.1 Supabase project.** Create the project in the Sydney region, then paste both connection strings into `apps/backend-api/.env.local`. Then run:
   ```bash
   npm run db:ping -w apps/backend-api
   npm run db:migrate -w apps/backend-api
   npm run db:seed -w apps/backend-api
   ```
4. **GitHub secrets.** Add the repository secrets `DATABASE_URL` (transaction pooler) and `DATABASE_URL_MIGRATIONS` (session pooler). Then go to Actions → "Database housekeeping" → Run workflow once (T6.9). It keeps the free Supabase project from pausing.

5. **Analytics (T7.9).** Create a free Cloudflare account. Go to Web Analytics → Add a site → `games4james.com` → "JS snippet", copy the 32-character token, and put it in `apps/player-web/src/config/brand.json` as `analyticsId`. Or send it to Claude and it will do it. Delete the old GA4 property if you like.

6. **Branch protection (T9.2).** GitHub → Settings → Branches → protect `main`: require the `CI / ci` check, require a pull request, no force-push.
7. **Backups (T9.6).** Create the S3 bucket and policy and add the `BACKUP_BUCKET` repo variable ([docs/runbooks/database-backup.md](../runbooks/database-backup.md)), then run it once and test a restore.

8. **Ko-fi (T12.1).** Create a Ko-fi page called `games4james`, so `https://ko-fi.com/games4james` works (or tell Claude the real URL for `brand.json` `supportUrl`). Use the brand logo and a two-line blurb. Then check the costs table on `/support` ([config/costs.ts](../../apps/player-web/src/config/costs.ts)); Claude guessed the AWS and tools amounts.

9. **Native apps (Phase 10).** Install Xcode and Android Studio, add the Firebase iOS and Android apps, then build and try them ([docs/native-setup.md](../native-setup.md)). The code, the native projects, icons and splash screens are ready; none of it has run on a device yet.

10. **AWS budget alert (T12.5).** Billing → Budgets → a monthly budget of A$5 with email alerts ([docs/money.md](../money.md)).

11. **Stripe (T12.2, after relaunch).** Set up the family supporter Payment Link and webhook ([docs/stripe-setup.md](../stripe-setup.md)). Until then, Settings → For grown-ups points to Ko-fi. Once the apps are live (T10.8), also set up the store product and RevenueCat (same doc, "In the store apps").

## Questions (Claude picked a default so work could continue; change it if you disagree)

- **Screen names (T6.7).** Generated names look like `bouncy-otter-42`. Kids can't use "James", "Tilly", "Harvey", "admin" or "official" inside a name, so nobody can pretend to be you. Rude words are filtered with the `obscenity` word list. Is that OK?
- **Daily clean-up (T6.9).** Guest accounts that never finished a game are deleted after 90 days without a visit. Is that OK?
- **Contact email.** The privacy and parents pages use `hello@games4james.com` (`brand.json` `contactEmail`). Does that inbox exist? If not, set one up (for example forwarding through your domain registrar or Route 53 + SES), or tell Claude which address to use.
- **Deleted accounts.** They disappear from leaderboards entirely rather than showing as "Deleted player". Is that OK?
- **Weekly stickers.** The weekly sticker needs 3 different days in one week (Monday to Sunday, the player's local time). It replaces the old streak celebration, and the day count still runs quietly. Is that OK?
- **Designer's notes to check (T11.1).** Claude drafted a short note for each game in a kid's voice, and guessed who dreamed each one up (`noteBy`, which also decides where it sits on the About page's "Our games, by maker" list). Please rewrite them with Tilly and Harvey and fix the names, then delete the `// TODO note` comment above each: Snapadile (Tilly), Blocker (Harvey), Box Cutter (Harvey), Cosmic Clash (Harvey), Flash Bash (Tilly), Hoop City (Tilly), Paddle Pop (Harvey), Reflex Ring (Tilly), Serpento (Harvey), Word Rush (Tilly), Word Stack (Tilly), and Stack Tower (Harvey, still beta). They live in `apps/player-web/src/games/<id>/manifest.ts`.
- **Supporter price and perks.** A one-off A$9 "family supporter" gives gold avatars, a Supporter sticker and a star by the name on leaderboards, for the grown-up and any kids linked to them. Nothing that affects play. Is that the price and the set you want?
