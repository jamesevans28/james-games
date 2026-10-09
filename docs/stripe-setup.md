# Family supporter purchase: Stripe setup (T12.2)

There's no Stripe code in the app. A grown-up opens a Stripe **Payment Link** (a hosted page) from Settings → For grown-ups, behind the parental gate. Stripe then calls our webhook, which records the supporter. Everything below is **MANUAL (James)**. Do it after relaunch; the plan has T12.2 depending on T13.

1. **Stripe account.** Create one at stripe.com: business type "individual", name "Games4James". Start in **Test mode**.
2. **Product.** Products → Add product. Name "Family supporter". One-off price: A$9, or whatever you choose; then update `supporterPrice` in `apps/player-web/src/config/brand.json` to match.
3. **Payment Link.** Payment Links → New for that product.
   - Set "After payment" to "Don't show confirmation page" and redirect to `https://games4james.com/settings?supporter=thanks`.
   - Turn off "Allow promotion codes" unless you want them.
   - Copy the link (`https://buy.stripe.com/...`) into `brand.json` as `supporterPaymentLink`. The app adds `?client_reference_id=<player id>` itself.
4. **Webhook.** Developers → Webhooks → Add endpoint.
   - URL: `https://api.games4james.com/billing/stripe/webhook`
   - Events: `checkout.session.completed`
   - Copy the signing secret (`whsec_...`) into the GitHub repository secret `STRIPE_WEBHOOK_SECRET`, then run **Deploy API**.
5. **Test.** Still in test mode, open Settings → For grown-ups → Become a family supporter and pay with card `4242 4242 4242 4242`. Your account and any linked kids should show gold avatars and the Supporter sticker. The webhook log in Stripe should show 200.
6. **Go live.** Switch to live mode, repeat steps 2–4 with live keys (a new link and a new secret), and redeploy.

Ko-fi supporters: admin → user → "Make supporter" (or `POST /admin/users/:id/supporter`) grants the same extras by hand.
