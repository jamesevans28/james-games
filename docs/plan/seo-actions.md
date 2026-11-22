# SEO: what James needs to do

From the SEO review on 27 Oct 2026. The code fixes are on branch `claude/seo-review-rankings-16d344`; nothing below is live until it is merged and deployed. Tick items off as you go.

## What the code change did (for reference)

- **One canonical per page.** `index.html` carried the home page's canonical, description, robots, Open Graph and JSON-LD, and every page added its own on top, so `/about` said "I'm a copy of the home page" first. The home tags are now marked `data-default-seo` and `src/main.tsx` removes them on boot.
- **Unknown and resting pages are `noindex`.** A catch-all "Page not found" route (`src/pages/NotFound.tsx`), and `/games/:id` is `noindex` unless the game is `active`. Crawlers asking for a beta or inactive game get a small `noindex` static page.
- **Static game pages are real pages** (what Googlebot gets for `/games/:id`): tagline, cover image with alt text, how to play, the designer's note, and links to four other games and the info pages.
- **Titles say what each game is.** A new optional manifest field `seo.keyphrase` gives "Serpento: free snake game for kids | Games4James".
- **Sitemap is clean.** It no longer lists the `noindex` leaderboards. `changefreq` and `priority` are gone (Google ignores them). `lastmod` only appears on game pages (from the manifest's `updatedAt`). Cover images are listed.
- **robots.txt:** `Crawl-delay` is gone (Google ignores it; it only slowed Bing).
- **Home page:** a short "Free games for kids, made by a family" paragraph under the grid, a descriptive H1 (screen-reader only), and alt text on every game cover.

## 1. Before you deploy: check the words (15 minutes)

- [ ] **Keyphrases.** These are drafts by Claude and appear in every game's title in Google. Edit `seo.keyphrase` in each `src/games/<id>/manifest.ts` (lower case, ending in "game", 32 characters max):

  | Game         | Keyphrase                |
  | ------------ | ------------------------ |
  | Blocker      | block puzzle game        |
  | Box Cutter   | line drawing arcade game |
  | Cosmic Clash | space shooter game       |
  | Flash Bash   | memory pattern game      |
  | Hoop City    | ball and hoops game      |
  | Paddle Pop   | brick breaker game       |
  | Reflex Ring  | reaction timing game     |
  | Serpento     | snake game               |
  | Word Rush    | word guessing game       |
  | Word Stack   | word ladder game         |
  | Snapadile    | crocodile tapping game   |

- [ ] **Designer's notes.** 13 manifests still have `// TODO note: James to replace` drafts. Crawlers now get these as "Tilly's note" and similar, so swap in the kids' real words. A real kid's quote is the most distinctive text on the site.
- [ ] **Home paragraph.** Read the blurb at the bottom of the home page (`AboutBlurb` in `src/pages/home/HomeGrid.tsx`) and put it in your own voice.
- [ ] **`updatedAt`.** Bump a game's `updatedAt` whenever the game or its cover really changes. That date is now the only `lastmod` in the sitemap. Snapadile still says 2025-11-25 even though it got a new cover in T8.4.

## 2. Deploy, then check (10 minutes)

- [ ] Merge the branch and run the deploy workflow when you're ready.
- [ ] Check what Googlebot gets, and that people still get the app:

```bash
curl -s -A Googlebot https://games4james.com/games/serpento | grep -o '<title>[^<]*'
```

```bash
curl -s -A Googlebot https://games4james.com/games/car-crash | grep -o '<meta name="robots"[^>]*>'
```

```bash
curl -s https://games4james.com/sitemap.xml | grep -c '<loc>'
```

The first should print "Serpento: free snake game for kids | Games4James", the second `noindex, follow`, and the third `16`.

## 3. Google Search Console (20 minutes, then once a week for a month)

- [ ] **Sitemaps:** resubmit `https://games4james.com/sitemap.xml`.
- [ ] **URL Inspection:** inspect `/`, `/about`, `/parents` and two or three game pages. Use "Test live URL" to confirm the canonical Google sees is the page itself, then click **Request indexing** on each.
- [ ] **Pages (indexing) report:** if it lists "Duplicate, Google chose different canonical than user", "Submitted URL marked noindex" or "Soft 404", open each one and click **Validate fix**.
- [ ] **Rich Results Test** (search.google.com/test/rich-results) on one game page: the VideoGame data should parse with no errors.
- [ ] **Performance report**, after 4 to 6 weeks: look at which searches show your pages ("Queries"). If a game gets impressions for words that aren't in its keyphrase, change the keyphrase to match. Share the export with Claude for a second pass.

## 4. Bing (5 minutes)

- [ ] Bing Webmaster Tools → **Import from Google Search Console**. This also covers DuckDuckGo and Yahoo, which use Bing's index.

## 5. Make `www.games4james.com` work (20 minutes, AWS)

Right now `www.games4james.com` doesn't resolve at all, so anyone who types it, or links to it, hits a dead end.

- [ ] ACM (us-east-1): make sure the games4james.com certificate also covers `www.games4james.com`, or request one that does.
- [ ] CloudFront → the games4james.com distribution → **Alternate domain names**: add `www.games4james.com`.
- [ ] DNS: add `www` as an alias (or CNAME) to the distribution.
- [ ] Redirect www to the main domain with a 301. The simplest way is a few lines at the top of `infra/cloudfront/bot-rewrite.js`: if the `host` header starts with `www.`, return a 301 to `https://games4james.com` plus the URI. Ask Claude to add it with a test, then paste and publish it as in `infra/cloudfront/README.md`.

## 6. Links from other sites (ongoing; the biggest lever for a new site)

Google ranks a new domain mostly on who links to it. "A dad makes games with his kids" is the story to tell:

- [ ] List the games on itch.io and the Phaser showcase (planned in `docs/growth/listings.md`).
- [ ] Post the first devlog: one kid's drawing, the sprite, then the game. A short video works for YouTube, TikTok and Instagram, with a link in the description.
- [ ] Pitch two or three parenting blogs, newsletters or local news sites. Lead with the "no ads, made by kids" angle and link to `/parents`.
- [ ] Submit to kid-safe game directories and "best free games for kids" lists.
- [ ] At relaunch: a Show HN or r/WebGames post ("I made 11 browser games with my kids").

## 7. Later (code, ask Claude)

- [ ] **Category pages** such as "Word games for kids" and "Arcade games", each with a paragraph of text and links to its games. These target the longer searches a small site can win. They need a route, a static page per category, and sitemap entries.
- [ ] **One HTML for everyone.** Googlebot currently gets a different page from people, which Google calls "dynamic rendering", an accepted workaround. Prerendering each game page at build time would show both the same HTML, so the bot rewrite could go.
- [ ] Fix the failing art test: `scripts/art/lib.test.mjs` expects 12 cover prompts but T8.4 made 13.
