import { useState } from "react";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { brand } from "../../config/brand";
import { useSupporter } from "../../hooks/useSupporter";
import { adapters } from "../../platform/adapters";
import { requestGrownUp } from "../../platform/parentGate";

/**
 * "For grown-ups" (T12.2): the family supporter purchase, behind the parental gate
 * on the web too. Cosmetic perks only. Inside the store apps the purchase goes
 * through the store instead (T12.3), so the Stripe link is web-only.
 */
export default function GrownUpsSection() {
  const { user } = useAuth();
  const supporter = useSupporter();
  const [open, setOpen] = useState(false);
  const link = brand.supporterPaymentLink;
  const canBuyHere = Boolean(link) && !adapters.app.isNative;
  const checkoutUrl =
    link && user?.userId
      ? `${link}${link.includes("?") ? "&" : "?"}client_reference_id=${encodeURIComponent(user.userId)}`
      : link;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-2 text-lg font-bold text-ink">For grown-ups</h2>
      {supporter ? (
        <p className="text-sm text-ink-2">
          Thank you for supporting {brand.name}! Your family has the gold avatars and the Supporter
          sticker. ★
        </p>
      ) : !open ? (
        <button
          type="button"
          className="btn btn-outline min-h-11"
          onClick={() => void requestGrownUp().then((ok) => ok && setOpen(true))}
        >
          Grown-ups: open
        </button>
      ) : (
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            {brand.name} is free with no ads. A one-off family supporter purchase (
            {brand.supporterPrice}) helps pay for running it and says thank you with cosmetic
            extras: gold avatars, a Supporter sticker and a star by your names. No game advantages,
            ever.
          </p>
          {canBuyHere && checkoutUrl ? (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center"
            >
              Become a family supporter
            </a>
          ) : (
            <p>
              You can also support us on Ko-fi from the Support us page, then email us your
              player&apos;s screen name for the thank-you extras.
            </p>
          )}
          <p className="text-xs">
            Payments are handled by Stripe; we never see card details. The receipt comes to you by
            email.
          </p>
        </div>
      )}
    </section>
  );
}
