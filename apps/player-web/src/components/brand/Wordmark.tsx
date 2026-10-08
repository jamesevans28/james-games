import { brand } from "../../config/brand";

type Props = { className?: string };

/**
 * The "Games4James" wordmark (public/brand/logo.svg, rendered by
 * scripts/generate-brand-icons.mjs). Size it with a height class, e.g. "h-8".
 */
export default function Wordmark({ className = "h-8" }: Props) {
  return <img src={brand.logo} alt={brand.name} className={`w-auto ${className}`} />;
}
