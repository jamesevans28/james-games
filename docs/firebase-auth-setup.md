# Firebase Authentication setup

Games4James uses Firebase Authentication only (no Firestore or Storage). Supported sign-ins:

- **Anonymous** (instant play);
- **username + PIN**: the backend checks the PIN and mints a custom token;
- **Google**;
- **Apple**, from Phase 10.

The database is Supabase Postgres (Phase 6); Firebase holds no game data.

The project is `games4james` (plan T6.0, decided 9 Oct 2026). It replaces the prototype's `flingo-fun` project, which is not used for anything and is deleted after relaunch (T13.6).

## Values

| Setting                 | Value                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Project id              | `games4james` (if taken, `games4james-app`: run the script with `G4J_FIREBASE_PROJECT=games4james-app`)  |
| Display name            | Games4James                                                                                              |
| Web app                 | `games4james-web`                                                                                        |
| Authorised domains      | `localhost`, `<project>.firebaseapp.com`, `<project>.web.app`, `games4james.com`, `auth.games4james.com` |
| Custom auth domain      | `auth.games4james.com` (relaunch, T13.3)                                                                 |
| OAuth handler URL       | `https://auth.games4james.com/__/auth/handler` (relaunch)                                                |
| Consent screen app name | Games4James                                                                                              |
| Consent screen logo     | `apps/player-web/public/brand/icon-512.png`                                                              |
| Home page / privacy     | `https://games4james.com` / `https://games4james.com/privacy`                                            |
| Service account key     | `~/.config/games4james/<project>-admin.json`. It is never committed and never pasted into chat.          |

## Set up the project (T6.0), MANUAL (James), about 15 minutes

1. **Log in, once:**

   ```bash
   firebase login
   ```

   ```bash
   gcloud auth login
   ```

   Use the Google account that should own the project.

2. **Run the script from the repo root:**

   ```bash
   scripts/firebase-setup.sh
   ```

   `--dry-run` prints what it would do. The script:
   - creates the project;
   - enables the Identity Toolkit API;
   - creates the web app;
   - writes the `VITE_FIREBASE_*` values into `apps/player-web/.env.local` and `apps/admin-web/.env.local`, keeping a `.bak` copy;
   - sets the authorised domains;
   - creates the backend service-account key and writes `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` into `apps/backend-api/.env.local`.

   It stops once and asks you to click **Authentication → Get started** and enable **Anonymous** in the console. Google offers no API for that first switch-on.

3. **Turn on Google sign-in.** In the console go to Authentication → Sign-in method → **Google** → Enable, pick your support email, and save. This also creates the web OAuth client.

4. **Brand the consent screen.** In Google Cloud console (same project) go to APIs & Services → **OAuth consent screen** (Branding). Set the app name, logo, home page and privacy URL from the table, then save.

5. **Restart and test:**
   - Restart `npm run dev` and `npm run server`.
   - In the app, play as a guest. That's an anonymous sign-in.
   - Create an account with a username and PIN, then sign out and back in.
   - Try "Continue with Google".

## At relaunch (T13.3), MANUAL (James)

1. **Custom auth domain:**
   - In Firebase console go to **Hosting** → Get started (skip the deploy steps) → **Add custom domain** → `auth.games4james.com`.
   - Add the DNS records it shows in Route 53 and wait for "Connected".
   - Set `VITE_FIREBASE_AUTH_DOMAIN=auth.games4james.com` in the GitHub variables (T13.4).
2. **Google web OAuth client** (Google Cloud → Credentials → "Web client (auto created by Google Service)"):
   - Add the authorised JavaScript origins `https://games4james.com` and `https://auth.games4james.com`.
   - Add the redirect URI `https://auth.games4james.com/__/auth/handler`.
3. **Apple** (Phase 10): on the Services ID, set the domain `auth.games4james.com` and the return URL from the table.

## How it fits together

- **Frontend:** `apps/player-web/src/lib/firebase.ts` initialises the web SDK from the `VITE_FIREBASE_*` variables. `context/FirebaseAuthProvider.tsx` owns every flow:
  - it signs in anonymously on first visit;
  - it upgrades by linking a provider or registering a username + PIN;
  - every API call sends `Authorization: Bearer <Firebase ID token>`.
- **Backend:** `apps/backend-api/src/middleware/authGuards.ts` verifies the ID token with the Admin SDK (`FIREBASE_*` env) and sets `req.user`. Username + PIN login checks the bcrypt PIN hash in the database, then returns a custom token the client signs in with.
- **Admin:** `apps/admin-web` signs in with Google. The API checks the `admin` flag on the user row.
- **Logs:** never log emails, usernames, user ids or raw Firebase error objects (see `apps/backend-api/src/lib/log.ts`).
