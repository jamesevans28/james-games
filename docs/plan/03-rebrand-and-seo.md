# Phase 3: Rebrand to Games4James and fix SEO

The brand is Games4James, by James, Tilly and Harvey. flingo.fun is gone. The visual restyle (sticker-book look) is applied here too, because the palette rename and the restyle touch the same files; the art assets themselves come from Phase 8 and can be swapped in later.

Good news already true: DynamoDB tables, the Lambda, the API domain and the home-screen icon are all Games4James. This phase deletes the flingo layer and makes one coherent identity.

## T3.1 `brand.ts` and the sticker-book token set
Status: done (2026-10-08). Brand values live in `src/config/brand.json` (so Vite and scripts can read them) and `brand.ts` re-exports them with `makersLine`, `siteUrl`, `BRAND_FONTS`, `BRAND_COLORS`. Extra tokens beyond the list: `card`, `edge`, `scrim`, `on-brand`, `on-accent`. The default Tailwind palette is off (`--color-*: initial`). The only remaining `flingo` strings under `apps/` are the legacy key names in `src/utils/storageKeys.ts` (remove after one release) and the real Firebase project id `flingo-fun`. A placeholder `public/brand/logo-mark.svg` ships now; T3.2 makes the full set. Meta keywords, the `@flingofun` handle and the WebSite SearchAction/alternateName were removed here (T3.4 steps 3 and 5 partly done).
Depends on: Phase 2 complete
Goal: one file owns every brand string, colour and asset path; the Tailwind theme uses semantic tokens.
Files: `apps/player-web/src/config/brand.ts` (new), `apps/player-web/src/index.css` (`@theme` block), `apps/player-web/index.html`, `apps/player-web/vite.config.ts` (manifest), `apps/admin-web/src/**` (title only)
Steps:
1. Create `brand.ts`:
   ```ts
   export const brand = {
     name: "Games4James", shortName: "G4J",
     tagline: "Little games made by James, Tilly and Harvey",
     makers: ["James", "Tilly", "Harvey"],
     origin: "https://games4james.com", apiOrigin: "https://api.games4james.com",
     themeColor: "#FF5A4E", backgroundColor: "#FFF8EC",
     logo: "/brand/logo.svg", logoSquare: "/brand/icon-512.png", ogImage: "/brand/og-1200x630.png",
     analyticsId: import.meta.env.VITE_ANALYTICS_ID ?? "",
     social: {},   // no handles until there are real ones
   } as const;
   ```
2. Replace the `flingo-*` palette in `index.css` `@theme` with semantic tokens: `--color-paper`, `--color-paper-2`, `--color-ink`, `--color-ink-2`, `--color-ink-3`, `--color-line`, `--color-tomato`, `--color-sun`, `--color-grass`, `--color-sky`, `--color-grape`, plus `--color-brand` (= tomato) and `--color-accent` (= sun). Values from the review's direction A: paper `#FFF8EC`, ink `#2B2118`, tomato `#FF5A4E`, sun `#FFC93C`, grass `#3DBE6B`, sky `#3FA9F5`, grape `#8E6CEF`. Light theme is the default; keep a dark variant via `prefers-color-scheme` with the same tokens.
3. Codemod the ~380 `*-flingo-*` class uses to the semantic tokens (write a small `scripts/codemod-brand-classes.mjs`; map by role, not by number, because the old scale is inverted). Remove `candy-*` aliases, `shadow-neon-*`, `.text-glow-*` and the radial neon glows in `RootLayout.tsx`.
4. Fonts: load `Baloo 2` (display), `Nunito` (body) and `Patrick Hand` (kids' notes) in `index.html`; export `BRAND_FONTS` from `brand.ts` for Phaser scenes (used in Phase 4).
5. Replace every hard-coded brand string with `brand.*`: `Seo.tsx`, `utils/seoKeywords.ts`, `utils/shareProfileLink.ts`, `pages/games/GameHeader.tsx`, `components/layout/Header.tsx`, `SplashScreen.tsx`, `SideDrawer.tsx`, `pages/firebase-login.tsx`, `pages/games/PlayGame.tsx`, `pages/home/HomeFeed.tsx`, `pages/games-list/index.tsx`, `pages/leaderboard/[gameId].tsx`, `pages/profile/[userId].tsx`, `components/feed/GameTile.tsx`. `index.html` gets its values via a Vite `transformIndexHtml` plugin reading `brand.ts`.
6. Storage keys: `flingo_last_played_games` → `g4j:lastPlayed`, `flingo_game_catalog_cache` → `g4j:catalog` with a read-old/write-new shim for one release.
Done when: `git grep -i flingo -- apps ':!apps/player-web/public'` returns nothing; the app renders in the new palette in light and dark; `npm run typecheck` passes.

## T3.2 Logo, icons and share image
Status: done (2026-10-08) except the post-deploy checks (Lighthouse install audit, link-preview tester) that run in T3.6. Placeholder art: `logo-mark.svg` is a hand-written sticker game pad; `logo.svg` and the PNGs come from `node scripts/generate-brand-icons.mjs` (sharp + opentype.js, fonts from @fontsource, text converted to paths). Avatars are 8 placeholder SVG animals in `public/brand/avatars/`, defined in `src/config/avatars.ts`; old sprite-sheet numbers wrap onto them, so no data migration. player-web is now `"type": "module"`.
Depends on: T3.1, T8.1 (style bible) for the final art; a placeholder set can ship first
Goal: one logo system, a full icon set, a proper Open Graph image.
Files: `apps/player-web/public/brand/` (new), `apps/player-web/public/favicon.svg`, `public/favicon.png`, `public/assets/shared/*`
Steps:
1. Logo: keep the rainbow "GAMES 4 JAMES" lettering idea from `assets/shared/logo_square.png`, re-drawn in the sticker-book style (thick ink outline, flat fills). Generate with the Phase 8 prompts; until then, vectorise the existing PNG with a clean background as a placeholder.
2. Produce: `logo.svg` (wordmark), `logo-mark.svg` (square mark), `icon-32.png`, `icon-180.png` (apple-touch), `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` (with 20% safe padding), `og-1200x630.png`. Write `scripts/generate-brand-icons.mjs` (sharp) that renders all PNGs from the two SVGs so regenerating is one command.
3. `index.html`: favicon links, apple-touch-icon, `theme-color` from brand. Manifest (vite config): `name`, `short_name`, `theme_color`, `background_color`, icons (192, 512, 512 maskable), `screenshots` (two phone screenshots from the Browser pane, 375×812 at 2×), `categories: ["games", "kids"]`.
4. Delete `assets/shared/flingo-logo*.svg`, `flingo-wordmark.svg`, the purple `favicon.svg`, and the 16×16 `favicon.png`. Move `logo_square.png` to `docs/archive/brand/`.
5. Remove `assets/shared/avatars.jpg` (Grok watermark) and `avatars.png` (fake checkerboard). Replace with a temporary 8-avatar set of simple SVG animal faces until Phase 8 delivers the AI set. Update `pages/settings/AvatarSelect.tsx` and `components/profile/ProfileAvatar.tsx` to read avatar definitions from `src/config/avatars.ts`.
Done when: Lighthouse PWA audit shows installable with maskable icon; sharing the home URL in a link-preview tester shows the new OG image; no file named `flingo*` remains in `public/`.

## T3.3 Copy and credits
Status: done (2026-10-08). Feed tiles show one plain status line ("Your best: N", "Played before", "Not played yet"); New/Updated/Continue stay as the feed badge. The PIN hint follows the real 4–8 digit rule rather than "6 numbers". Registry entries gained `makers`, `note` and `noteBy`. Puzzle answers like "TOM HANKS" in Word Rush's word lists are content, not the placeholder character, and stay until Word Rush is re-themed in Phase 5. Manifest screenshots (T3.2) were taken here.
Depends on: T3.1
Goal: the site reads as made by a family, not an app store.
Files: `components/layout/Header.tsx`, `SideDrawer.tsx`, `pages/home/HomeFeed.tsx`, `pages/games/GameLanding.tsx`, `GameOver.tsx`, `pages/firebase-login.tsx`, `games/index.ts` (titles/descriptions), `utils/seoKeywords.ts` (`GAME_SEO_META`)
Steps:
1. Header: wordmark + "by James, Tilly & Harvey" small line (from `brand.makers`).
2. Rename "Word Rush with Tom" to "Word Rush". Drop every "Tom".
3. Replace feed hooks ("🔥 Popular!", "Welcome back!") with plain labels: "New", "Updated", "Your best: N". Remove emoji-as-labels.
4. Login: "Sign in" / "Create account" consistently; remove the "PIN like a birthday" hint; replace with "Pick 6 numbers you'll remember (not your birthday)". Unify "Log in" vs "Sign In" to "Sign in".
5. Game landing: add a "Made by" line with the makers from the game's registry entry (field `makers?: string[]`, default `brand.makers`) and a "Designer's note" block when the entry has `note` (content comes in Phase 11; wire the field now).
6. Rewrite `GAME_SEO_META` taglines in the family voice; remove "safe games for kids" and "no ads" claims from meta unless they are true at relaunch (no ads is true; keep that one).
Done when: a read-through of every screen in the Browser pane finds no "flingo", "Tom", "For You", or emoji section markers; the landing page shows "Made by James, Tilly & Harvey".

## T3.4 SEO origin, static pages, sitemap, structured data
Status: done (2026-10-08) in code; MANUAL: attach the CloudFront Function (infra/cloudfront/README.md), then the curl and Rich Results checks run after the T3.6 deploy. The generator reads brand.json, asserts the parsed game count matches the registry's `load()` entries (not a fixed 16, so new games don't break it), skips beta and `status: "inactive"` games, and now actually reads GAME_SEO_META (the old parser never matched). Static pages use a raster `og:image` (SVG thumbnails fall back to the brand card), escape every value, and redirect people with a path-guarded script. Meta keywords and the keyword lists are gone. Found while here: the deploy marks everything under `dist/assets/` immutable, including un-hashed game art copied from `public/assets/` (see T3.6 step 5).
Note (from T1.9): stop generating public/games-index.html in scripts/generate-sitemap.mjs and delete it (deleting the file alone just regenerates it).
Depends on: T3.1
Goal: every URL the site advertises is games4james.com, and each game has its own link preview.
Files: `apps/player-web/package.json` (`generate-seo`), `scripts/generate-sitemap.mjs`, `apps/player-web/public/{sitemap.xml,robots.txt,game-meta.json,static-games/*}`, `apps/player-web/index.html`, `src/components/Seo.tsx`
Steps:
1. `generate-seo`: `SITE_ORIGIN=https://games4james.com`. In `generate-sitemap.mjs`, read the origin from `brand.ts` (import via a small JSON export, or move brand to `packages/brand/brand.json` consumed by both src and scripts) and read game metadata from the registry/manifests rather than regex-parsing TS (Phase 4 provides manifests; until then keep the regex but assert it finds 16 games).
2. Regenerate `sitemap.xml`, `robots.txt`, `game-meta.json`, `static-games/*.html`. Delete `games-index.html`.
3. Structured data: `WebSite` + `Organization` (name Games4James, logo, no `alternateName`, no SearchAction), and per-game `VideoGame` JSON-LD in `Seo.tsx`.
4. Per-game previews for crawlers: add a CloudFront Function (or Lambda@Edge) that, for requests to `/games/:id` from bot user agents (facebookexternalhit, Twitterbot, WhatsApp, Slackbot, Discordbot, Googlebot, bingbot, LinkedInBot, iMessage's `facebookexternalhit`), rewrites to `/static-games/:id.html`. Commit the function source in `infra/cloudfront/bot-rewrite.js` and document the MANUAL attach step (Phase 9 automates it if IaC is adopted). Remove the `<meta http-equiv="refresh">` from the static pages and use a `<script>` redirect for humans instead, so crawlers keep the page.
5. Remove `meta keywords` (ignored by Google) and the Twitter `@flingofun` handle.
Done when: `curl -A facebookexternalhit https://games4james.com/games/snapadile` returns the Snapadile static page with its own `og:image`; `sitemap.xml` has 0 flingo URLs; Google Rich Results test passes for the home page and one game page.

## T3.5 Firebase auth domain, authorised domains, OAuth consent
Status: todo
Depends on: T3.1
Goal: the Google/Apple sign-in screens say Games4James, not flingo-fun.
MANUAL (James) with Claude preparing the exact values:
1. Firebase console → Authentication → Settings → Authorised domains: add `games4james.com` (and `localhost` is already there). Remove `flingo.fun`.
2. Custom auth domain: Hosting → add a custom domain `auth.games4james.com` to the `flingo-fun` project (Firebase requires Hosting for a custom `authDomain`), then set `VITE_FIREBASE_AUTH_DOMAIN=auth.games4james.com` in GitHub repo vars and `.env.local`. DNS: add the TXT and A/CNAME records Firebase shows, in Route 53 (or wherever games4james.com DNS lives).
3. Google Cloud console → APIs & Services → OAuth consent screen: app name "Games4James", support email, logo (icon-512), privacy policy URL `https://games4james.com/privacy` (page from T7.8; create a placeholder first).
4. Apple Developer → Services ID: return URL `https://auth.games4james.com/__/auth/handler`.
5. Claude updates `docs/firebase-auth-setup.md` with these steps and the final values (no secrets).
Done when: signing in with Google from games4james.com shows "Games4James" on the consent screen and the redirect goes through `auth.games4james.com`.

## T3.6 Deploy the rebrand and move Search Console
Status: todo
Depends on: T3.2, T3.3, T3.4, T3.5, Phase 9 pipeline or the existing one
Goal: games4james.com serves the rebranded build; search engines know.
Steps:
1. GitHub repo vars: `VITE_API_BASE_URL=https://api.games4james.com`, `CORS_ALLOWED_ORIGINS=https://games4james.com,http://localhost:3000`, `VITE_FIREBASE_AUTH_DOMAIN=auth.games4james.com`.
2. Merge to `main`; pipeline deploys web, admin and API.
3. MANUAL (James): Google Search Console: add property `games4james.com` (DNS verification), submit `https://games4james.com/sitemap.xml`. If the old flingo.fun property still exists, there's nothing to redirect (domain lapsed); just let it expire.
4. MANUAL (James): GA4 → Admin → Data streams → update the stream URL to games4james.com (or complete T7.9 first and skip this).
5. Check `https://games4james.com` headers: `index.html` is `no-store`, hashed assets are `immutable`.
Done when: `curl -s https://games4james.com | grep -c flingo` is 0; Search Console shows the sitemap accepted; the Google sign-in screen shows Games4James.
