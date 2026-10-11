# Native apps: setup and running (Phase 10)

The iOS and Android apps are Capacitor 8 shells around the same web build (`apps/player-web/ios`, `apps/player-web/android`). Claude wrote all the code, but this Mac has neither Xcode nor Android Studio, so nothing native has been built or run yet. The first run is yours.

## One-time setup, MANUAL (James)

1. **Xcode** from the Mac App Store, then:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app
   ```
   Open Xcode once to install the iOS simulator.
2. **Android Studio** from developer.android.com. In its setup wizard, install an SDK and create one emulator, for example a Pixel with the latest API.
3. **Sign-in.** The apps sign in through Supabase like the web (guest and username + PIN), so there is no Firebase app, `GoogleService-Info.plist` or `google-services.json`. Native Google and Apple sheets are T14.4, deferred while `features.socialSignIn` is off. When it is turned on: a Google Cloud iOS and an Android OAuth client id (added to the Supabase Google provider's "authorized client ids"), the Apple Services ID and key for the Supabase Apple provider, Sign in with Apple in Xcode (needs the Apple Developer account, T10.6), and the `com.games4james.app://auth/callback` scheme. See `docs/supabase-auth-setup.md`.
4. **CORS.** At relaunch, add `capacitor://localhost,https://localhost` to the `CORS_ALLOWED_ORIGINS` variable (T13.4), so the apps can call the API.

## Build and run

From the repo root:

```bash
npm run web:build
```

```bash
npm run cap:sync -w apps/player-web
```

Then open the project in Xcode or Android Studio and press Run:

```bash
npm run cap:ios -w apps/player-web
```

```bash
npm run cap:android -w apps/player-web
```

Check these:

- home grid, a game, game over and settings;
- Android back: pauses a game, then leaves it;
- the screen stays on during a run;
- a new best gives a little buzz;
- turn on airplane mode, finish a run, turn it off, and the score appears on the leaderboard;
- guest play, then create a username + PIN, sign out and sign back in with it.

## Icons and splash

The sources are made by `node scripts/generate-app-assets.mjs`, from `public/brand/logo-mark.svg`. To write every size, run this in `apps/player-web`:

```bash
npx @capacitor/assets generate --ios --android
```

Rerun both when the Phase 8 logo lands (T8.7).
