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
 * Fills index.html from src/config/brand.json so the brand lives in one place:
 * `%BRAND.key%` → the value (HTML-escaped), plus the JSON-LD block. (Analytics loads
 * from src/lib/webAnalytics.ts, so the native apps can leave it out.)
 */
export function brandHtml(): Plugin {
  const values: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(brand).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    makersLine: makersLine(brand.makers),
  };
  return {
    name: "brand-html",
    transformIndexHtml(html) {
      return html
        .replace(/%BRAND\.([a-zA-Z]+)%/g, (match, key: string) => {
          const value = values[key];
          if (value === undefined) throw new Error(`index.html uses unknown brand key ${match}`);
          return escapeHtml(value);
        })
        .replace("<!-- %BRAND_JSONLD% -->", jsonLd());
    },
  };
}
