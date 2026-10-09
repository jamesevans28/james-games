// Centralized app configuration
// Minimal declarations for env without Node types wired in this workspace

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 8787),
  corsAllowedOrigins: (
    process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3100"
  )
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:8787",
  /** The public site, for share links and redirects (T11.5). No trailing slash. */
  publicSiteOrigin: (process.env.PUBLIC_SITE_ORIGIN || "https://games4james.com").replace(
    /\/+$/,
    "",
  ),
  /** Stripe webhook signing secret (whsec_…), T12.2. Empty: every webhook is rejected. */
  stripeWebhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
  /** The Authorization value RevenueCat sends (we check "Bearer <this>"), T12.3. */
  revenueCatWebhookAuth: (process.env.REVENUECAT_WEBHOOK_AUTH || "").trim(),
  // Firebase configuration
  firebase: {
    projectId: (process.env.FIREBASE_PROJECT_ID || "").trim(),
    clientEmail: (process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").trim(),
  },
};
