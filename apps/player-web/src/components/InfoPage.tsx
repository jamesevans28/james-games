import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import Seo from "./Seo";
import GrownUpLink from "./GrownUpLink";
import { brand, siteUrl } from "../config/brand";

/**
 * Layout for the plain-words pages (About, Privacy, Parents; T7.8): a title, a
 * short intro, then sections as cards. Jumps to `#section` links on arrival
 * (React Router doesn't), without smooth scrolling.
 */
export default function InfoPage({
  path,
  title,
  description,
  intro,
  children,
}: {
  path: string;
  title: string;
  description: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 text-ink">
      <Seo
        title={`${title} | ${brand.name}`}
        description={description}
        url={siteUrl(path)}
        canonical={siteUrl(path)}
      />
      <h1 className="text-3xl font-extrabold mb-2">{title}</h1>
      <div className="text-base text-ink-2 mb-6">{intro}</div>
      {children}
      <InfoLinks current={path} />
    </div>
  );
}

export function InfoSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="bg-card rounded-2xl border border-line p-5 mb-4 scroll-mt-20">
      <h2 className="text-lg font-extrabold mb-2">{title}</h2>
      <div className="text-base space-y-2">{children}</div>
    </section>
  );
}

export function InfoList({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5">{children}</ul>;
}

/** mailto link to the family inbox (brand.contactEmail). */
export function ContactEmail({ subject }: { subject?: string }) {
  const href = `mailto:${brand.contactEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <GrownUpLink href={href} className="font-bold text-brand underline break-all">
      {brand.contactEmail}
    </GrownUpLink>
  );
}

const PAGES = [
  { to: "/about", label: "About us" },
  { to: "/parents", label: "For grown-ups" },
  { to: "/privacy", label: "Privacy" },
] as const;

function InfoLinks({ current }: { current: string }) {
  return (
    <nav aria-label="More about us" className="mt-6 flex flex-wrap gap-2">
      <Link to="/" className="btn btn-primary">
        Back to the games
      </Link>
      {PAGES.filter((p) => p.to !== current).map((p) => (
        <Link key={p.to} to={p.to} className="btn btn-outline">
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
