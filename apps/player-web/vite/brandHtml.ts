import type { Plugin } from "vite";
import brand from "../src/config/brand.json" with { type: "json" };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function makersLine(makers: string[]): string {
  return makers.length <= 1
    ? makers.join("")
    : `${makers.slice(0, -1).join(", ")} & ${makers[makers.length - 1]}`;
}

function jsonLd(): string {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: `${brand.origin}/`,
    logo: `${brand.origin}${brand.logoSquare}`,
    founder: brand.makers.map((name) => ({ "@type": "Person", name })),
  };
  const site = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: `${brand.origin}/`,
    description: brand.description,
    publisher: { "@type": "Organization", name: brand.name, url: `${brand.origin}/` },
  };
  return [site, org]
    .map((data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`)
    .join("\n    ");
}

/**
 * Cloudflare Web Analytics (T7.9, DECISIONS 2026-10-09): cookieless page views, no
 * personal data. `token` is the site token from the Cloudflare dashboard. `spa: true`
 * counts route changes. Production builds only.
 */
function analytics(token: string): string {
  if (!/^[a-f0-9]{32}$/i.test(token)) return "";
  const beacon = JSON.stringify({ token, spa: true });
  return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${beacon}'></script>`;
}

/**
 * Fills index.html from src/config/brand.json so the brand lives in one place:
 * `%BRAND.key%` → the value (HTML-escaped), plus the JSON-LD and analytics blocks.
 */
export function brandHtml(analyticsId: string | undefined): Plugin {
  const values: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(brand).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    makersLine: makersLine(brand.makers),
  };
  let isBuild = false;
  return {
    name: "brand-html",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    transformIndexHtml(html) {
      return html
        .replace(/%BRAND\.([a-zA-Z]+)%/g, (match, key: string) => {
          const value = values[key];
          if (value === undefined) throw new Error(`index.html uses unknown brand key ${match}`);
          return escapeHtml(value);
        })
        .replace("<!-- %BRAND_JSONLD% -->", jsonLd())
        .replace(
          "<!-- %BRAND_ANALYTICS% -->",
          isBuild ? analytics(analyticsId ?? brand.analyticsId) : "",
        );
    },
  };
}
