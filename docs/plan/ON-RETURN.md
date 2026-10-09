# On your return: questions and actions for James

Claude worked through the plan unattended on 9 Oct 2026. **All code for Phases 6–13 is written, tested and merged to `main`.** That's about 640 automated tests, with CI green. What's left needs your accounts, your consoles, your art, or your say-so. Answer the questions inline or in chat; Claude reads this file at the start of the next session.

## Try it first (10 minutes, no accounts needed)

```bash
npm install
```

Then run these four, each in its own terminal tab:

```bash
npm run local:auth
```

```bash
npm run local:server
```

```bash
npm run local:web
```

```bash
npm run local:admin
```

`local:auth` is a fake Firebase. `local:server` is the API on a local database. `local:web` is the app at http://localhost:3000, and `local:admin` is the admin at http://localhost:3100.

Things to try:

- sign up with a username and PIN;
- play, and see "New best!", stickers and the share button;
- `/daily` and the remix sliders on Snapadile;
- the 2-player toggle;
- friends with friend codes, using two browsers;
- Settings → Family and "For grown-ups";
- `/about`, `/parents`, `/privacy` and `/support`.

## Actions only you can do

### Now (unblocks everything else)

1. **Node 24.** Run `nvm install 24`, so `npm` commands run without the `npx -p node@24` wrapper.
2. **Firebase project (T6.0).** Run `firebase login`, then `gcloud auth login`, then `scripts/firebase-setup.sh`. After that, enable Google sign-in and brand the consent screen ([docs/firebase-auth-setup.md](../firebase-auth-setup.md)).
3. **Supabase project (T6.1).** Create it in the Sydney region and paste both connection strings into `apps/backend-api/.env.local`. Then run:
   ```bash
   npm run db:ping -w apps/backend-api
   ```
   ```bash
   npm run db:migrate -w apps/backend-api
   ```
   ```bash
   npm run db:seed -w apps/backend-api
   ```
4. **GitHub secrets.** Add `DATABASE_URL` (transaction pooler) and `DATABASE_URL_MIGRATIONS` (session pooler). Then go to Actions → "Database housekeeping" → Run workflow once. It also stops the free Supabase project from pausing.
5. **The art (Phase 8), the main thing blocking relaunch.** Make the covers using [docs/art/README.md](../art/README.md):
   ```bash
   node scripts/art/generate.mjs --dry-run covers
   ```
   That prints the prompts; paste them into ChatGPT or Ideogram. Or add an `IMAGE_API_KEY` to `.env.local` and Claude can generate them. Process each cover:
   ```bash
   node scripts/art/cover.mjs <id> <file>
   ```
   Then sprites, avatars, stickers, the logo and sounds as you like. This also lifts Lighthouse performance from about 80–86 to the target 90, because the WebP covers replace the old JPG/SVG ones.

### Before relaunch

6. **Analytics (T7.9).** Create a free Cloudflare account → Web Analytics → add `games4james.com` → copy the 32-character token into `apps/player-web/src/config/brand.json` as `analyticsId`, or send it to Claude.
7. **Ko-fi (T12.1).** Create the page `https://ko-fi.com/games4james`, or tell Claude the real URL. Check the cost table on `/support` ([config/costs.ts](../../apps/player-web/src/config/costs.ts)); the AWS and tools amounts are guesses.
8. **Contact inbox.** `hello@games4james.com` is on the privacy and parents pages; make it exist (see the questions below).
9. **Branch protection (T9.2).** GitHub → Settings → Branches → protect `main`: require the `CI / ci` check and a pull request, and block force-pushes.
10. **Backups (T9.6).** Create the S3 bucket and add the `BACKUP_BUCKET` variable ([runbooks/database-backup.md](../runbooks/database-backup.md)), then run it once and test a restore.
11. **AWS budget alert (T12.5).** Billing → Budgets → A$5 a month with email alerts.

### Relaunch day (Phase 13)

12. Follow the runbook in [docs/relaunch-log.md](../relaunch-log.md):
    - GitHub variables;
    - the Deploy API, web and admin workflows;
    - the `auth.games4james.com` custom domain;
    - the CloudFront link-preview function, plus the `/s/*` behaviour for share cards ([infra/cloudfront/README.md](../../infra/cloudfront/README.md));
    - Search Console.

    Claude does the rest: the checks, and switching on auto-deploy.

13. **First release.** Actions → Release → `minor`, which makes the first tag. Every build after that shows its version in the drawer.

### After relaunch

14. **Stripe (T12.2).** Set up the family supporter Payment Link and webhook ([docs/stripe-setup.md](../stripe-setup.md)). Until then, "For grown-ups" points to Ko-fi.
15. **Native apps (Phase 10).**
    - Install Xcode and Android Studio and add the Firebase iOS and Android apps ([docs/native-setup.md](../native-setup.md)). The Android build already passes on GitHub (Actions → Build Android gives an APK).
    - Enrol in the Apple Developer Program (US$99/yr) and Google Play (US$25).
    - The listing text is drafted in [docs/store/listing.md](../store/listing.md), and the Kids-category checklist is [docs/store/kids-compliance.md](../store/kids-compliance.md).
    - When the apps are live, set up the store product and RevenueCat (stripe-setup.md, "In the store apps").
16. **30 days after relaunch (T13.6).** Delete the old DynamoDB tables and the `flingo-fun` Firebase project (runbook step 6).

## Questions

Claude picked a default for each so work could continue. Change any you disagree with.

- **Screen names (T6.7).** Generated names look like `bouncy-otter-42`. Names can't contain "James", "Tilly", "Harvey", "admin" or "official", so nobody can pretend to be you. Rude words are filtered with the `obscenity` list, and players get 3 changes per 30 days. Is that OK?
- **Daily clean-up (T6.9).** Guest accounts that never finished a game are deleted after 90 days without a visit. Is that OK?
- **Contact email.** The pages use `hello@games4james.com` (`brand.json` `contactEmail`). Does that inbox exist? If not, set one up (for example forwarding through your domain registrar), or tell Claude which address to use.
- **Deleted accounts.** They disappear from leaderboards entirely rather than showing as "Deleted player". Is that OK?
- **Weekly stickers.** A sticker for playing on 3 different days in one week (Monday to Sunday, local time) replaces the old streak celebration. The day count still runs quietly. Is that OK?
- **Designer's notes (T11.1).** Claude drafted a short note per game in a kid's voice and guessed who dreamed each one up. Please rewrite them with Tilly and Harvey, fix the names, and delete the `// TODO note` comment above each. They're in `apps/player-web/src/games/<id>/manifest.ts`. The guesses:
  - Tilly: Snapadile, Flash Bash, Hoop City, Reflex Ring, Word Rush, Word Stack;
  - Harvey: Blocker, Box Cutter, Cosmic Clash, Paddle Pop, Serpento, Stack Tower (beta), Colour Sort (beta).
- **Remix boards.** A remix run earns XP and stickers but never touches the game's normal leaderboard; each remix has its own board. Otherwise an easy remix would top the real board. Is that OK?
- **Colour Sort (T11.8).** It's the new puzzle game, in beta. Have a play. Once the family has played it for a week, does it go active? It needs a real note, a cover and sounds first.
- **Supporter price and perks (T12.2).** A one-off A$9 "family supporter" gives gold avatars, a Supporter sticker and a star by the name on leaderboards, for the grown-up and any linked kids. Nothing affects play. Is that the price and the set you want?
- **Merch (T12.4).** Do you want sticker sheets of the characters (print on demand, no stock), once the Phase 8 art exists?
