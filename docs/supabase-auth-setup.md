# Supabase Auth setup

Games4James signs players in with Supabase Auth (Phase 14, decided 11 Oct 2026), in the same Supabase account that holds the data. Supported sign-ins:

- **Guest**: an anonymous Supabase user, created on the first visit;
- **username + PIN**: the API checks the PIN (bcrypt, throttled) and mints a one-time sign-in with the admin API; the guest keeps its id;
- **Google** and **Apple**: in the code but hidden (`features.socialSignIn = false` in `apps/player-web/src/config/features.ts`). No Google or Apple setup is needed until that flag is turned on.

Two free projects:

| Project           | Used for                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `games4james`     | Production: data (Phase 6) and sign-in                                                                                  |
| `games4james-dev` | Sign-in for local development and Browser-pane checks only (data stays in pglite), so test users never reach production |

## What the script sets

`scripts/supabase-auth-setup.mjs` PATCHes `https://api.supabase.com/v1/projects/<ref>/config/auth` on each project. A PATCH changes only the fields it names; never use `supabase config push`, which resets every setting the local file doesn't declare.

| Setting                            | Dev                                                                                                    | Prod                                                                                                             | Why                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `site_url`                         | `http://localhost:3000`                                                                                | `https://games4james.com`                                                                                        | Where Supabase sends people when a redirect isn't allowed                                                       |
| `uri_allow_list`                   | `http://localhost:3000/auth/callback`, `http://localhost:3100/`, `com.games4james.app://auth/callback` | `https://games4james.com/auth/callback`, `https://admin.games4james.com/`, `com.games4james.app://auth/callback` | The player app returns to `/auth/callback`; the admin returns to its home page; the app scheme is for T14.4     |
| `external_anonymous_users_enabled` | on                                                                                                     | on                                                                                                               | Guests                                                                                                          |
| `security_manual_linking_enabled`  | on                                                                                                     | on                                                                                                               | A guest links Google/Apple and keeps its id                                                                     |
| `disable_signup`                   | off                                                                                                    | off                                                                                                              | Turning sign-ups off would also block guests                                                                    |
| `external_email_enabled`           | on                                                                                                     | on                                                                                                               | The PIN accounts' sign-in (`generateLink` + `verifyOtp`) goes through the email provider; no email is ever sent |
| `mailer_autoconfirm`               | off                                                                                                    | off                                                                                                              | "Confirm email" on: a password sign-up from outside never gets a session                                        |
| `external_google_enabled`          | off (on with `--google`)                                                                               | off (on with `--google`)                                                                                         | Social sign-in is hidden                                                                                        |

It also moves each project to an **ES256 signing key** (imports the legacy secret, creates an ES256 key, makes it current) so the API can verify tokens against `/auth/v1/.well-known/jwks.json` with no shared secret. If that part fails, it says so and you do it by hand (below).

For the dev project it then writes, without printing them:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` into `apps/player-web/.env.local` and `apps/admin-web/.env.local`;
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` into `apps/backend-api/.env.local`.

Each file keeps a `.bak` of its previous version. Production keys are never written to disk; the script prints the GitHub names to set instead.

PIN accounts' auth users carry a synthetic email `<username>@pin.games4james.com`. It is never shown, mailed or returned by the API, and the domain is ours.

## Set it up (T14.0), MANUAL (James), about 10 minutes

1. **Create the dev project.** Supabase dashboard → New project → name `games4james-dev`, the same region as `games4james` (ap-southeast-2), any database password (it holds no data).
2. **Create a personal access token.** Supabase → Account → Access tokens → Generate. Export it in your terminal only:

   ```bash
   export SUPABASE_ACCESS_TOKEN=<paste>
   ```

3. **Look first, then run, from the repo root:**

   ```bash
   node scripts/supabase-auth-setup.mjs --dry-run
   ```

   ```bash
   node scripts/supabase-auth-setup.mjs
   ```

4. **If it printed "ES256 key: not done":** for that project, dashboard → Project Settings → JWT Keys → "Migrate JWT secret", then "Create standby key" → **ES256** → "Rotate keys" so it is current. The legacy secret stays valid while it rotates.
5. **Check:**

   ```bash
   curl -s https://<dev-ref>.supabase.co/auth/v1/.well-known/jwks.json
   ```

   It should list a key with `"alg":"ES256"`. Then `grep -c SUPABASE apps/*/.env.local` shows 2 in each file.

6. **Try it:** `npm run local:server`, `npm run local:web`, play as a guest, make a username + PIN, sign out and back in (T14.8 has the full list).

Unset the token when you're done (`unset SUPABASE_ACCESS_TOKEN`), or revoke it in the dashboard.

## The admin console needs Google

The admin (`apps/admin-web`) signs James in with **Google** only, then checks `users.admin`. With Google off on a project, nobody can sign in to that project's admin. So before relaunch, for at least the production project (and dev if you want to try the admin locally):

1. Google Cloud (any project, no Firebase) → APIs & Services → OAuth consent screen: app name "Games4James", logo `apps/player-web/public/brand/icon-512.png`, home page `https://games4james.com`, privacy `https://games4james.com/privacy`.
2. Credentials → Create OAuth client → **Web application**, with redirect URIs `https://<prod-ref>.supabase.co/auth/v1/callback` and `https://<dev-ref>.supabase.co/auth/v1/callback`.
3. Run the script with the client:

   ```bash
   GOOGLE_OAUTH_CLIENT_ID=<id> GOOGLE_OAUTH_CLIENT_SECRET=<secret> node scripts/supabase-auth-setup.mjs --google
   ```

Turning Google on in Supabase does not show it to players: the buttons stay hidden until `features.socialSignIn` is `true`. Google's consent screen says "to continue to `<ref>.supabase.co`"; a custom auth domain (below) changes that.

## At relaunch (T13.3), MANUAL (James)

1. Run the script for production if you haven't (`--only prod`, with `--google` for the admin as above).
2. GitHub → Settings → Secrets and variables → Actions:
   - variables `VITE_SUPABASE_URL` and `SUPABASE_URL` (`https://<prod-ref>.supabase.co`), `VITE_SUPABASE_PUBLISHABLE_KEY` (production publishable key);
   - secret `SUPABASE_SECRET_KEY` (a production secret key).
3. Apple (only with social sign-in, Phase 10): an Apple Services ID and key, entered under Authentication → Providers → Apple, plus the native client ids in T14.4.

## Custom auth domain, later (optional)

A custom domain such as `auth.games4james.com` is a paid add-on (about US$10 a month). With it, Google's consent screen shows our domain. Dashboard → Project Settings → Custom Domains, add the CNAME in Route 53, then add the new callback URL to the Google client and switch `VITE_SUPABASE_URL`/`SUPABASE_URL` to it.

## How it fits together

- **Player web:** `apps/player-web/src/lib/supabase.ts` is the Supabase Auth client (`@supabase/auth-js`, a lazy chunk; sessions in the platform storage adapter). `context/AuthProvider.tsx` owns every flow and sends `Authorization: Bearer <access token>` to the API. `/auth/callback` finishes Google/Apple redirects.
- **API:** `apps/backend-api/src/middleware/authGuards.ts` verifies the ES256 access token with `jose` against the project's JWKS (cached, no call per request) and reads `app_metadata.account_type`. `services/supabaseAuthService.ts` holds the admin calls (`convertToPinAccount`, `mintSignIn`, `setAccountType`, `deleteAuthUser`). `npm run auth:view -w apps/backend-api` shows auth users without printing emails.
- **Admin:** `apps/admin-web/src/lib/supabase.ts`, Google redirect, `users.admin` checked by the API.
- **Offline work:** `supabase start` (Docker) runs a local Auth server; point the same env names at `http://127.0.0.1:54321` and its keys. Not required.
- **Logs:** never log emails, usernames, user ids, token hashes or raw auth-library errors (see `apps/backend-api/src/lib/log.ts`).
