# Native apps: setup and running (Phase 10)

The iOS and Android apps are Capacitor 8 shells around the same web build (`apps/player-web/ios`, `apps/player-web/android`). Claude wrote all the code, but this Mac has neither Xcode nor Android Studio, so nothing native has been built or run yet. The first run is yours.

## One-time setup, MANUAL (James)

1. **Xcode** from the Mac App Store, then:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app
   ```
   Open Xcode once to install the iOS simulator.
2. **Android Studio** from developer.android.com. In its setup wizard, install an SDK and create one emulator, for example a Pixel with the latest API.
3. **Firebase apps (T10.3).** In the Firebase console, open the `games4james` project and go to Project settings → Your apps:
   - **iOS app.** Bundle ID `com.games4james.app`. Download `GoogleService-Info.plist` into `apps/player-web/ios/App/App/`.
   - **iOS Google sign-in.** In Xcode, open App → Info → URL Types, add one, and set its URL scheme to the `REVERSED_CLIENT_ID` value from that plist.
   - **Android app.** Package `com.games4james.app`. Add the SHA-1 of your debug keystore, which you can get with:
     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
     Later, add the release key's SHA-1 too. Download `google-services.json` into `apps/player-web/android/app/`.
   - **Apple sign-in.** Firebase → Authentication → Sign-in method → Apple → enable. In Xcode, App → Signing & Capabilities → + Sign in with Apple. This needs the Apple Developer account (T10.6).
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
- Google sign-in, then Apple on iOS.

## Icons and splash

The sources are made by `node scripts/generate-app-assets.mjs`, from `public/brand/logo-mark.svg`. To write every size, run this in `apps/player-web`:

```bash
npx @capacitor/assets generate --ios --android
```

Rerun both when the Phase 8 logo lands (T8.7).
