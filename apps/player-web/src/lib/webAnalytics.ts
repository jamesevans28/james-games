/**
 * Cloudflare Web Analytics (T7.9): cookieless page views, no personal data.
 * Production web builds only, never inside the iOS/Android apps: the Apple Kids
 * category allows no third-party analytics (T10.7). `spa: true` counts route changes.
 */
import { brand } from "../config/brand";
import { adapters } from "../platform/adapters";

export function startWebAnalytics(): void {
  const token = brand.analyticsId;
  if (!import.meta.env.PROD || adapters.app.isNative) return;
  if (!/^[a-f0-9]{32}$/i.test(token)) return;
  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token, spa: true });
  document.head.appendChild(script);
}
