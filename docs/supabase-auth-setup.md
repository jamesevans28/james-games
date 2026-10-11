# Supabase Auth setup

Games4James signs players in with Supabase Auth (Phase 14, decided 11 Oct 2026), in the same Supabase account that holds the data. Supported sign-ins:

- **Guest**: an anonymous Supabase user, created on the first visit;
- **username + PIN**: the API checks the PIN (bcrypt, throttled) and mints a one-time sign-in with the admin API; the guest keeps its id;
- **email code**: a grown-up can attach an email to a username + PIN account (Settings), confirmed with a 6-digit code Supabase emails. That email can then sign in with an emailed code (a forgotten PIN), and it is how James signs in to the admin console;
- **Google** and **Apple**: in the code but hidden (`features.socialSignIn = false` in `apps/player-web/src/config/features.ts`; `adminConfig.googleSignIn = false` in the admin). No Google or Apple setup is needed until they are turned on.

## Projects

| Project           | Used for                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `games4james`     | Production: data (Phase 6) and sign-in. **Until a dev project exists, local development signs in here too.**                             |
| `games4james-dev` | Later, optional: sign-in for local development and Browser-pane checks only (data stays in pglite), so test users stay out of production |

The script works out which mode it is in. With no `games4james-dev` project it configures `games4james` with both the production and the localhost redirect URLs and writes its keys into the local `.env.local` files. Once you create `games4james-dev` (same region, any password) and rerun the script, local development moves there and the production redirect list loses localhost. Nothing in the apps changes; they only read the `.env.local` values.

## What the script sets

`scripts/supabase-auth-setup.mjs` PATCHes `https://api.supabase.com/v1/projects/<ref>/config/auth`. A PATCH changes only the fields it names; never use `supabase config push`, which resets every setting the local file doesn't declare.

| Setting                                      | Value                                                                                                                                                                                                                   | Why                                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `site_url`                                   | `https://games4james.com` (`http://localhost:3000` on a dev project)                                                                                                                                                    | Where Supabase sends people when a redirect isn't allowed                                                 |
| `uri_allow_list`                             | `https://games4james.com/auth/callback`, `https://admin.games4james.com/`, the app scheme, plus `http://localhost:3000/auth/callback` and `http://localhost:3100/` while local development shares the project           | Google/Apple redirects (player `/auth/callback`, admin home page); the app scheme is for T14.4            |
| `external_anonymous_users_enabled`           | on                                                                                                                                                                                                                      | Guests                                                                                                    |
| `security_manual_linking_enabled`            | on                                                                                                                                                                                                                      | A guest links Google/Apple and keeps its id                                                               |
| `disable_signup`                             | off                                                                                                                                                                                                                     | Turning sign-ups off would also block guests                                                              |
| `external_email_enabled`                     | on                                                                                                                                                                                                                      | Email codes, and the PIN sign-in (`generateLink` + `verifyOtp`)                                           |
| `mailer_autoconfirm`                         | off                                                                                                                                                                                                                     | "Confirm email" on: a password sign-up from outside never gets a session                                  |
| `mailer_otp_length`, `mailer_otp_exp`        | 6 digits, 15 minutes                                                                                                                                                                                                    | The codes in the emails                                                                                   |
| `mailer_secure_email_change_enabled`         | off                                                                                                                                                                                                                     | A PIN account's old address is the synthetic one, which can't receive mail; only the new address confirms |
| `mailer_notifications_email_changed_enabled` | off                                                                                                                                                                                                                     | Same reason: no notice to the synthetic address                                                           |
| `mailer_subjects_*`, `mailer_templates_*`    | "Your Games4James sign-in code" and "Confirm your email for Games4James", each showing only the code. **Only sent once SMTP is set**: Supabase refuses template changes on free-tier projects using its built-in sender | Codes instead of links work across devices (read it on a phone, type it on a tablet)                      |
| `smtp_*`                                     | from `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL` when set                                                                                                                                    | See "Email delivery"                                                                                      |
| `external_google_enabled`                    | off (on with `--google`)                                                                                                                                                                                                | Social sign-in is hidden                                                                                  |

It also moves the project to an **ES256 signing key** (imports the legacy secret, creates an ES256 key, makes it current) so the API can verify tokens against `/auth/v1/.well-known/jwks.json` with no shared secret. If that part fails, it says so and you do it by hand (below).

Then it writes the keys local development uses, without printing them:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` into `apps/player-web/.env.local` and `apps/admin-web/.env.local`;
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` into `apps/backend-api/.env.local`.

Each file keeps a `.bak` of its previous version. `--env-dir <path>` writes them under another checkout.

PIN accounts' auth users start with a synthetic email `<username>@pin.games4james.com`; it is replaced by the grown-up's address when one is confirmed. The synthetic one is never shown, mailed or returned by the API, and the domain is ours.

## Email delivery

Supabase sends every email (codes, email confirmations). Its **built-in sender only delivers to the project's team members**, a few an hour, and on the free plan it **won't take custom templates**, so its emails carry Supabase's default link instead of our 6-digit code. So the email features need a mail server before they work end to end, even for James. Before real players add emails (at the latest at relaunch), set up a mail server, for example Resend or Amazon SES (both have free tiers), and rerun the script with:

```bash
SMTP_HOST=<host> SMTP_PORT=587 SMTP_USER=<user> SMTP_PASS=<password> SMTP_ADMIN_EMAIL=hello@games4james.com node scripts/supabase-auth-setup.mjs
```

The sender address needs the mail service's DNS records (SPF/DKIM) for `games4james.com` in Route 53. Until then, a player who tries to add an email sees "We can't send email to that address yet."

## Set it up, MANUAL (James), about 5 minutes

1. **Create a personal access token.** Supabase → Account → Access tokens → Generate, and copy it. Then save it from the clipboard, outside the repo and readable only by you (nothing prints it, and it stays out of your shell history):

   ```bash
   mkdir -p ~/.config/games4james && umask 077 && pbpaste > ~/.config/games4james/supabase-access-token
   ```

   (`export SUPABASE_ACCESS_TOKEN=…` in a terminal works too.)

2. **Look first, then run, from the repo root:**

   ```bash
   node scripts/supabase-auth-setup.mjs --dry-run
   ```

   ```bash
   node scripts/supabase-auth-setup.mjs
   ```

3. **If it printed "ES256 key: not done":** dashboard → Project Settings → JWT Keys → "Migrate JWT secret", then "Create standby key" → **ES256** → "Rotate keys" so it is current.
4. **Check:**

   ```bash
   curl -s https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
   ```

   It should list a key with `"alg":"ES256"`. `grep -c SUPABASE apps/*/.env.local` shows 2 in each file.

5. **Make yourself the admin.** In the player app (`npm run local:server`, `npm run local:web`): create a username + PIN, then Settings → "A grown-up's email" → your email → type the code. Then in the Supabase SQL editor:

   ```sql
   update users set admin = true where email = '<your email>';
   ```

   `npm run local:admin` → your email → the code → you're in.

Delete the token file when you're done if you like (`rm ~/.config/games4james/supabase-access-token`), or revoke it in the dashboard.

## Google for the admin or players, later

1. Google Cloud (any project, no Firebase) → APIs & Services → OAuth consent screen: app name "Games4James", logo `apps/player-web/public/brand/icon-512.png`, home page `https://games4james.com`, privacy `https://games4james.com/privacy`.
2. Credentials → Create OAuth client → **Web application**, with the redirect URI `https://<ref>.supabase.co/auth/v1/callback` for each project.
3. Run the script with the client:

   ```bash
   GOOGLE_OAUTH_CLIENT_ID=<id> GOOGLE_OAUTH_CLIENT_SECRET=<secret> node scripts/supabase-auth-setup.mjs --google
   ```

4. Show the buttons: `adminConfig.googleSignIn` (admin) and `features.socialSignIn` (players). Google's consent screen says "to continue to `<ref>.supabase.co`"; a custom auth domain (below) changes that.

## At relaunch (T13.3), MANUAL (James)

1. If a dev project exists by then, rerun the script so production loses the localhost redirects (`--only prod` touches production only).
2. Mail server set up (see "Email delivery").
3. GitHub → Settings → Secrets and variables → Actions:
   - variables `VITE_SUPABASE_URL` and `SUPABASE_URL` (`https://<prod-ref>.supabase.co`), `VITE_SUPABASE_PUBLISHABLE_KEY` (production publishable key);
   - secret `SUPABASE_SECRET_KEY` (a production secret key).
4. Apple (only with social sign-in, Phase 10): an Apple Services ID and key, entered under Authentication → Providers → Apple, plus the native client ids in T14.4.

## Custom auth domain, later (optional)

A custom domain such as `auth.games4james.com` is a paid add-on (about US$10 a month). With it, Google's consent screen shows our domain. Dashboard → Project Settings → Custom Domains, add the CNAME in Route 53, then add the new callback URL to the Google client and switch `VITE_SUPABASE_URL`/`SUPABASE_URL` to it.

## How it fits together

- **Player web:** `apps/player-web/src/lib/supabase.ts` is the Supabase Auth client (`@supabase/auth-js`, a lazy chunk; sessions in the platform storage adapter). `context/AuthProvider.tsx` owns every flow and sends `Authorization: Bearer <access token>` to the API. Settings → "A grown-up's email" (`pages/settings/EmailSection.tsx`) attaches an email with `updateUser` + `verifyOtp(email_change)`, then `POST /auth/sync-email`; the login page's "Sign in with an email code" (`pages/auth/EmailCodeSignIn.tsx`) uses `signInWithOtp` (never creates accounts) + `verifyOtp(email)`. `/auth/callback` finishes Google/Apple redirects.
- **API:** `apps/backend-api/src/middleware/authGuards.ts` verifies the ES256 access token with `jose` against the project's JWKS (cached, no call per request) and reads `app_metadata.account_type`. `services/supabaseAuthService.ts` holds the admin calls (`convertToPinAccount`, `mintSignIn` by user id, `setAccountType`, `deleteAuthUser`). `POST /auth/sync-email` copies a confirmed email from the token onto the row. `npm run auth:view -w apps/backend-api` shows auth users without printing emails.
- **Admin:** `apps/admin-web/src/lib/supabase.ts`: an emailed code (or Google once on); `users.admin` is checked by the API.
- **Offline work:** `supabase start` (Docker) runs a local Auth server; point the same env names at `http://127.0.0.1:54321` and its keys. Not required.
- **Logs:** never log emails, usernames, user ids, token hashes or raw auth-library errors (see `apps/backend-api/src/lib/log.ts`).
