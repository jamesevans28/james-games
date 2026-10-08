# Phase 10: Capacitor (App Store and Play Store)

Decision: Capacitor wraps the same web build. Groundwork (T10.1–T10.3) can start once the SDK exists (Phase 4). Store submission (T10.6+) waits for Phase 7 (kid safety) and Phase 8 covers/icons. Nothing here should slow the web relaunch.

Costs: Apple Developer Program US$99/year (MANUAL, James decides when); Google Play one-off US$25. Everything else is free. James has a Mac, so iOS builds are local Xcode.

## T10.1 Platform adapters in the SDK

Status: done 2026-10-09 (platform/adapters: storage, session, network, share, haptics, app; web + Capacitor; the grep in Done-when is empty)
Depends on: T4.4
Goal: every native-sensitive capability goes through an adapter with a web implementation now and a Capacitor implementation later.
Files: `apps/player-web/src/platform/adapters/{storage,network,share,haptics,analytics,auth,app}.ts`, `platform/host.ts`, `context/FirebaseAuthProvider.tsx`
Steps:

1. Interfaces: `StorageAdapter` (get/set/remove, async), `NetworkAdapter` (isOnline, onChange), `ShareAdapter` (share({title,url}) with clipboard fallback), `HapticsAdapter` (tap/success/fail), `AnalyticsAdapter`, `AuthAdapter` (signInWithGoogle/Apple/anonymous, link, signOut), `AppAdapter` (isNative, platform, openUrl, exitGame).
2. Web implementations wrap localStorage, `navigator.onLine`, Web Share, `navigator.vibrate`, the chosen analytics, Firebase web SDK popups.
3. `platform/adapters/index.ts` exports `adapters` chosen at startup by `Capacitor.isNativePlatform()` (import guarded so the web bundle doesn't include native code).
4. Replace every direct use in `src/` (not games; they already go through the host) with the adapters.
   Done when: `git grep -n "localStorage\|navigator.onLine\|navigator.share\|signInWithPopup" apps/player-web/src --exclude-dir=adapters` is empty; web behaviour unchanged.

## T10.2 Capacitor project scaffold

Status: done in code 2026-10-09 (Capacitor 8.5.2, ios/ and android/ generated, icons and splash from scripts/generate-app-assets.mjs, base "/", no SW or install hints natively, safe areas); MANUAL: install Xcode and Android Studio, then `npx cap run ios` / `android` to check (this Mac has neither)
Depends on: T10.1, T3.2 (icons)
Files: `apps/player-web/capacitor.config.ts`, `apps/player-web/ios/`, `apps/player-web/android/`, `.gitignore` updates, `package.json` scripts
Steps:

1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android @capacitor/preferences @capacitor/network @capacitor/share @capacitor/haptics @capacitor/app @capacitor/status-bar @capacitor/splash-screen -w apps/player-web` (latest 8.x).
2. `npx cap init "Games4James" "com.games4james.app" --web-dir dist`; `npx cap add ios`; `npx cap add android`. Commit the native projects (they are generated but customised later).
3. `capacitor.config.ts`: `server.androidScheme: "https"`, `ios.contentInset: "always"`, splash from brand background colour, status bar style.
4. Vite: `base: "/"` and absolute asset paths resolve under `capacitor://localhost` and `https://localhost`; remove the `<base href>`/`base: "./"` inconsistency; use `import.meta.env.BASE_URL` for asset URLs in code.
5. Disable the service worker, `InstallPWA`, `IOSInstallHint` and `SWUpdatePrompt` when native.
6. Icons and splash: `@capacitor/assets` generates all sizes from `public/brand/icon-1024.png` and a splash source; commit the outputs.
7. Scripts: `cap:sync`, `cap:ios`, `cap:android`.
8. Safe areas: the game header and stage use `env(safe-area-inset-*)`; test on an iPhone simulator with a notch.
   Done when: `npm run web:build && npx cap sync` then `npx cap run ios` (simulator) shows the app; home grid, a game, game over and settings work; the same on an Android emulator.

## T10.3 Native auth

Status: todo
Depends on: T10.2
Files: `platform/adapters/auth.capacitor.ts`, Firebase console (MANUAL), `ios/App/App/Info.plist`, `android/app/google-services.json`
Steps:

1. `npm i @capacitor-firebase/authentication firebase` (matching versions). Implement `AuthAdapter` for native using `FirebaseAuthentication.signInWithGoogle()`/`signInWithApple()`/`signInAnonymously()` with `skipNativeAuth: false` and credential hand-off to the web SDK (`signInWithCredential`) so the backend token flow stays identical.
2. MANUAL (James): Firebase console (the `games4james` project from T6.0) → add iOS app (bundle `com.games4james.app`) and Android app (package `com.games4james.app`, SHA-1 of the debug and release keystores); download `GoogleService-Info.plist` and `google-services.json` into the native projects (gitignore the release ones if they contain restricted keys; the Firebase config is not secret but keep the pattern tidy). Enable Apple sign-in in Firebase and in the Apple Developer portal (Sign in with Apple capability).
3. Username+PIN works unchanged (plain HTTPS to the API). Add the native origins to `CORS_ALLOWED_ORIGINS` (`capacitor://localhost`, `https://localhost`).
   Done when: Google and Apple sign-in work on simulator/emulator; anonymous → PIN upgrade works; the backend sees the same uid as the web.

## T10.4 Offline queue and native storage

Status: todo
Depends on: T10.1, T6.3
Steps: score/sticker submissions are queued in `StorageAdapter` when offline and flushed on reconnect (idempotency key = play id; backend accepts duplicates idempotently). Best scores and play history live in Preferences on native.
Done when: play offline on the simulator, reconnect, see the score on the leaderboard; a test covers the queue logic.

## T10.5 Haptics, status bar, back button, keep-awake

Status: todo
Depends on: T10.2
Steps: haptic tick on perfect/best; status bar colour from brand; Android hardware back = pause/close dialog, never exit mid-game without confirm; keep the screen awake during play (`@capacitor-community/keep-awake`).
Done when: checked on both platforms.

## T10.6 Store accounts and listings (MANUAL, Claude-prepared)

Status: todo
Depends on: Phase 7 complete, T8.4, T8.7
MANUAL (James): enrol in the Apple Developer Program and Google Play Console. These accounts are also needed for in-app purchases (T12.3), so they pay for themselves if the supporter tier works; enrol once Phase 7 is done so the store review happens soon after the web relaunch. Claude prepares: app name, subtitle, description (family voice), keywords, category (Games › Family/Kids; Apple Kids category with age band 6–8), privacy nutrition labels (data: identifiers (uid), user content (screen name, scores); not used for tracking), content rating questionnaire answers, screenshots (generate 6.7" and 6.1" iPhone and Android phone sets from the Browser pane/simulator with the `scripts/art/store-shots.mjs` frame compositor), privacy policy URL (T7.8), support URL (parents page).
Done when: both listings exist in draft with all assets uploaded.

## T10.7 Apple Kids category compliance checklist

Status: todo
Depends on: T10.6
Steps: no third-party analytics SDK that tracks (web analytics snippet off in the native build, or Cloudflare analytics which is cookieless; if GA4 is kept, disable it natively); parental gate (simple arithmetic question) before external links (parents page, support email) and before any purchase; no ads; no social features that expose kids publicly (friends-only already); account deletion in-app (T7.8). Document in `docs/store/kids-compliance.md`.
Done when: the checklist is complete with evidence links.

## T10.8 First releases

Status: todo
Depends on: T10.6, T10.7, T9.8
Steps: TestFlight internal build (James, Tilly, Harvey as testers), Play internal testing track; fix what they find; submit for review. Record review feedback in `docs/store/review-log.md`.
Done when: both apps are live.
