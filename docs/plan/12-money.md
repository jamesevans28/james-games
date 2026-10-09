# Phase 12: Money, without ads

Goal: the site pays for its own running costs and the store accounts, from people who like what a dad and two kids are making. Rules that never change (DECISIONS 2026-10-09): **no ads, no tracking SDKs, no engagement pressure, nothing a kid can buy on their own.** Every payment is made by a grown-up on a page that says so, through a provider that handles the card (we never see card details). In the store apps a parental gate (T10.7) sits in front of every link to money.

Expectations: with a small audience this is tens of dollars a month at best for a while. The point is to have the rails in place at relaunch, in the family voice, and to let the story (building in public with the kids, Phase 11) do the selling. Revisit the numbers three months after relaunch (T11.10).

## T12.1 Support page and link (before relaunch)

Status: done in code 2026-10-09 (`/support` with a costs table from `config/costs.ts`, linked from the drawer, About and the game-over small print); MANUAL: create the Ko-fi page at the URL in `brand.json` `supportUrl`
Depends on: T7.8 (about/privacy pages), T8.7 (brand assets)
Goal: one page that explains who makes the games, what it costs to run, and how to help, with zero compliance burden.
Files: `apps/player-web/src/pages/support.tsx` (new), `components/SideDrawer.tsx`, `pages/about.tsx`, `src/config/brand.ts` (`supportUrl`)
Steps:

1. MANUAL (James): create a Ko-fi account (0% fee on donations; Buy Me a Coffee is the alternative at 5%). Page name "Games4James", the brand logo, a two-line blurb in the family voice. Put the page URL in `brand.json` as `supportUrl`.
2. `/support` page: what the money is for (hosting, the store accounts, art generation), what it isn't (no ads, ever), a big "Support us on Ko-fi" button, and the costs in plain numbers (a small table Claude keeps honest from the AWS, Supabase and store bills). Link it from the drawer ("Support us"), the About page footer and the game-over dialog's small print ("Made by a family. Support us"). Never on the game canvas, never as an overlay.
3. The button opens in a new tab on the web. In the native build it goes through the parental gate (T10.7).
4. Thank-you: supporters who tell us their screen name get the "Supporter" sticker by hand through the admin (T6.8 moderation actions) until T12.2 automates it.
   Done when: the page renders at 375 px in light and dark; the Ko-fi link works; privacy page mentions it (T7.8).

## T12.2 Supporter perks (cosmetic, bought by a grown-up)

Status: done in code 2026-10-09 (supporters table, signed webhook without the Stripe SDK, idempotent, family inherits perks, gold avatars, star on boards, admin grant/revoke, gated Grown-ups section); MANUAL: Stripe account, Payment Link, webhook secret (docs/stripe-setup.md), after relaunch
Depends on: T6.3, T8.6 (avatar and sticker sets), T11.4 (stickers), T12.1, relaunch done (T13)
Goal: a one-off "Family supporter" purchase that unlocks cosmetics for every account in the family, nothing that affects scores.
Files: backend `services/supporterService.ts`, `routes/billing.routes.ts`, schema `supporters` (user_id, source enum('stripe','apple','google'), external_id, granted_at), frontend `pages/settings/SettingsScreen.tsx` ("Grown-ups" section), `config/avatars.ts` (packs)
Steps:

1. Perks (all cosmetic): two extra avatar packs, a gold "Supporter" sticker on the profile and leaderboard row, a name colour, and a "Thank you from Tilly, Harvey and James" card. No power-ups, no extra lives, no leaderboard advantage.
2. Web purchase through a Stripe Payment Link (no Stripe SDK in the app; a hosted page). One price, one-off (suggest A$9; James sets it). The link carries the family code (T11.7) or the payer's user id as `client_reference_id`. A `POST /billing/stripe/webhook` Lambda route verifies the signature and writes `supporters`. Receipts come from Stripe by email, to the grown-up.
3. The "Grown-ups" section in settings is behind the arithmetic parental gate from T10.7 (shared helper `platform/parentGate.ts`, also used by the web) and explains in two sentences what is bought and that it's for grown-ups.
4. Tests: webhook signature failure is rejected; a granted supporter unlocks packs; duplicates are idempotent.
   Done when: a test-mode Stripe payment grants the perks locally; a kid cannot reach the purchase page without the gate.

## T12.3 In-app purchase in the store builds

Status: todo
Depends on: T10.8 (apps live), T12.2
Goal: the same supporter purchase inside the iOS and Android apps, as the stores require for digital goods.
Steps: RevenueCat (free under US$2.5k/month revenue) with `@revenuecat/purchases-capacitor`, one non-consumable product `family_supporter` in App Store Connect and Play Console, server-side entitlement check from RevenueCat's webhook into `supporters` (source `apple`/`google`), restore purchases, and the Kids-category parental gate before the purchase sheet. Family Sharing on. No subscription until there is a reason for one.
Done when: sandbox purchases on both platforms grant the perks; restore works; the compliance checklist (T10.7) is updated with the purchase flow.

## T12.4 Merch (optional)

Status: todo (only if the kids want it)
Steps: print-on-demand stickers of the Phase 8 characters (Redbubble or Printful, no stock), linked from the support page. More brand than income.
Done when: a sticker sheet is orderable and one is on the fridge.

## T12.5 Cost and income hygiene

Status: set up 2026-10-09 (docs/money.md); MANUAL: AWS budget alert; rows start the first month after relaunch
Depends on: T13 (so the real bills exist)
Steps: AWS budget alert at A$5/month (MANUAL: James, Billing → Budgets); Supabase and Ko-fi/Stripe dashboards bookmarked in `docs/money.md`; a monthly line in that file: hosting cost, Ko-fi, Stripe, store income, what was spent. Claude updates the support page's cost table from it. Consider a separate bank account or Stripe payout schedule (James's call; outside this repo).
Done when: `docs/money.md` has three monthly rows.
