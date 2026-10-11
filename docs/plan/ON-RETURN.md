# On your return: questions and actions for James

Claude worked through the plan unattended on 9 Oct 2026, and Phase 14 (auth on Supabase, Firebase removed) landed on 11 Oct. **All code is written, tested and merged to `main`**: about 650 automated tests, CI green. What's left needs your accounts, your consoles, your art, or your say-so. Reviewed against every task file on 11 Oct 2026. Answer the questions inline or in chat; Claude reads this file at the start of the next session.

## Try it first (10 minutes)

```bash
npm install
```

Sign-in uses your `games4james` Supabase project (the setup script has run and the keys are in each app's `.env.local`). Run these three, each in its own terminal tab:

```bash
npm run local:server
```

```bash
npm run local:web
```

```bash
npm run local:admin
```

`local:server` is the API on a local database (sign-in through Supabase). `local:web` is the app at http://localhost:3000, and `local:admin` is the admin at http://localhost:3100.

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
2. ~~**Supabase Auth (T14.0).**~~ Done 11 Oct: the script configured `games4james`, ES256 keys are on, and guest, username + PIN, sign-out, sign-in and delete were checked end to end against it.
   - **Production secret.** Add the GitHub secret `SUPABASE_SECRET_KEY` (the deploy needs it; the variables are already set).
   - **Mail server.** Pick Resend or Amazon SES, add its DNS records for `games4james.com`, and rerun the script with `SMTP_*` ([docs/supabase-auth-setup.md](../supabase-auth-setup.md), "Email delivery"). Until then nobody can sign in by emailed code, and that includes you in the admin console. Then make yourself admin: add your email in the player app's Settings and set `admin` on your row.
   - **T14.8.** Claude finishes the end-to-end check (admin sign-in, numbers) once the mail server exists.
3. ~~**Supabase project (T6.1).**~~ Done 11 Oct: connected, migrated and seeded. The strings are in `apps/backend-api/.env.local`.
4. ~~**GitHub secrets.**~~ Done 11 Oct: `DATABASE_URL` and `DATABASE_URL_MIGRATIONS` set, housekeeping green.
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
    - the CloudFront link-preview function, plus the `/s/*` behaviour for share cards ([infra/cloudfront/README.md](../../infra/cloudfront/README.md));
    - Search Console.

    Claude does the rest: the checks, and switching on auto-deploy.

13. **First release.** Actions → Release → `minor`, which makes the first tag. Every build after that shows its version in the drawer.

### After relaunch

14. **Stripe (T12.2).** Set up the family supporter Payment Link and webhook ([docs/stripe-setup.md](../stripe-setup.md)). Until then, "For grown-ups" points to Ko-fi.
15. **Native apps (Phase 10).**
    - Install Xcode and Android Studio ([docs/native-setup.md](../native-setup.md)); no Firebase apps any more. The Android build already passes on GitHub (Actions → Build Android gives an APK).
    - Enrol in the Apple Developer Program (US$99/yr) and Google Play (US$25).
    - The listing text is drafted in [docs/store/listing.md](../store/listing.md), and the Kids-category checklist is [docs/store/kids-compliance.md](../store/kids-compliance.md).
    - When the apps are live, set up the store product and RevenueCat (stripe-setup.md, "In the store apps").
16. **30 days after relaunch (T13.6).** Delete the old DynamoDB tables, the `flingo-fun` Firebase project, and the old GitHub `FIREBASE_*` secrets and `VITE_FIREBASE_*` variables (runbook step 6).

## Questions

Claude picked a default for each so work could continue. Change any you disagree with.

- **Screen names (T6.7).** Generated names look like `bouncy-otter-42`. Names can't contain "James", "Tilly", "Harvey", "admin" or "official", so nobody can pretend to be you. Rude words are filtered with the `obscenity` list, and players get 3 changes per 30 days. Is that OK?
- **Daily clean-up (T6.9).** Guest accounts that never finished a game are deleted after 90 days without a visit, and (from the follow-up session) their Supabase sign-in users go with them. Is that OK?
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
- **Google and Apple sign-in** are hidden (`features.socialSignIn`). Turn them on later? That needs a Google Cloud OAuth client, and Apple's Services ID for the store apps.

## Not yours, but not done (by design)

- T6.10 (API on Supabase Edge Functions), T11.9 (reviving cut games), T11.11 (Games4[YourName]) and T12.4 (merch) are deferred or optional ideas.
- T14.4 (native Google and Apple sign-in) waits for the social sign-in switch.
- T10.8 (first store releases) waits for your developer accounts.
- Browser-pane checks left for launch day: the sticker book (T11.4), pass-and-play (T11.6) and the family view (T11.7).
