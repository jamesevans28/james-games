export type SeoProps = {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  siteName?: string;
  noindex?: boolean;
  canonical?: string;
  keywords?: string;
  author?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  ogType?: "website" | "article" | "game";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

export default function Seo({
  title,
  description,
  url,
  image,
  siteName = "flingo.fun",
  noindex,
  canonical,
  keywords,
  author,
  articlePublishedTime,
  articleModifiedTime,
  ogType = "website",
  jsonLd,
}: SeoProps) {
  // Support both single object and array of JSON-LD schemas
  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      {/* Standard Metadata */}
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {canonical && <link rel="canonical" href={canonical} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {author && <meta name="author" content={author} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      {url && <meta property="og:url" content={url} />}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:site_name" content={siteName} />
      {image && <meta property="og:image" content={image} />}
      {image && <meta property="og:image:alt" content={title || siteName} />}
      <meta property="og:locale" content="en_US" />

      {/* Article dates for Open Graph */}
      {articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}
      {articleModifiedTime && (
        <meta property="article:modified_time" content={articleModifiedTime} />
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
      <meta name="twitter:site" content="@flingofun" />

      {/* JSON-LD - Support multiple schemas */}
      {jsonLdArray.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          data-seo-schema="true"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
