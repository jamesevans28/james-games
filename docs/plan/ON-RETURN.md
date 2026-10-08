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

## Questions (Claude picked a default so work could continue; change it if you disagree)

- **Screen names (T6.7).** Generated names look like `bouncy-otter-42`. Kids can't use "James", "Tilly", "Harvey", "admin" or "official" inside a name, so nobody can pretend to be you. Rude words are filtered with the `obscenity` word list. Is that OK?
- **Daily clean-up (T6.9).** Guest accounts that never finished a game are deleted after 90 days without a visit. Is that OK?
- **Contact email.** The privacy and parents pages use `hello@games4james.com` (`brand.json` `contactEmail`). Does that inbox exist? If not, set one up (for example forwarding through your domain registrar or Route 53 + SES), or tell Claude which address to use.
- **Deleted accounts.** They disappear from leaderboards entirely rather than showing as "Deleted player". Is that OK?
- **Weekly stickers.** The weekly sticker needs 3 different days in one week (Monday to Sunday, the player's local time). It replaces the old streak celebration, and the day count still runs quietly. Is that OK?

