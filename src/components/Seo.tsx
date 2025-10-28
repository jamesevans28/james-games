import { useEffect } from "react";

export type SeoProps = {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  siteName?: string;
  noindex?: boolean;
  canonical?: string;
};

function upsertMeta(selector: string, attrs: Record<string, string>) {
  const head = document.head;
  let el = head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
}

function upsertLinkRel(rel: string, href: string) {
  const head = document.head;
  let el = head.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export default function Seo({
  title,
  description,
  url,
  image,
  siteName = "Games4James",
  noindex,
  canonical,
}: SeoProps) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      upsertMeta("meta[name='description']", { name: "description", content: description });
    }

    if (canonical) upsertLinkRel("canonical", canonical);

    if (noindex) {
      upsertMeta("meta[name='robots']", { name: "robots", content: "noindex, nofollow" });
    } else {
      // Ensure we don't leave noindex lying around
      const robots = document.head.querySelector("meta[name='robots']");
      if (robots) robots.parentElement?.removeChild(robots);
    }

    // Open Graph
    if (title) upsertMeta("meta[property='og:title']", { property: "og:title", content: title });
    if (description)
      upsertMeta("meta[property='og:description']", {
        property: "og:description",
        content: description,
      });
    if (url) upsertMeta("meta[property='og:url']", { property: "og:url", content: url });
    upsertMeta("meta[property='og:type']", { property: "og:type", content: "website" });
    upsertMeta("meta[property='og:site_name']", { property: "og:site_name", content: siteName });
    if (image) upsertMeta("meta[property='og:image']", { property: "og:image", content: image });

    // Twitter
    if (title) upsertMeta("meta[name='twitter:title']", { name: "twitter:title", content: title });
    if (description)
      upsertMeta("meta[name='twitter:description']", {
        name: "twitter:description",
        content: description,
      });
    if (image) upsertMeta("meta[name='twitter:image']", { name: "twitter:image", content: image });
    upsertMeta("meta[name='twitter:card']", {
      name: "twitter:card",
      content: "summary_large_image",
    });
  }, [title, description, url, image, siteName, noindex, canonical]);

  return null;
}
