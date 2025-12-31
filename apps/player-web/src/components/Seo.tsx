export type SeoProps = {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  siteName?: string;
  noindex?: boolean;
  canonical?: string;
  jsonLd?: Record<string, any>;
};

export default function Seo({
  title,
  description,
  url,
  image,
  siteName = "flingo.fun",
  noindex,
  canonical,
  jsonLd,
}: SeoProps) {
  return (
    <>
      {/* Standard Metadata */}
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {canonical && <link rel="canonical" href={canonical} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      {url && <meta property="og:url" content={url} />}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:site_name" content={siteName} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json" data-seo-schema="true">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </>
  );
}
