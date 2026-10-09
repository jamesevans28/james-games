import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryClient";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { brand } from "../../config/brand";
import { useSupporter } from "../../hooks/useSupporter";
import { adapters } from "../../platform/adapters";
import { requestGrownUp } from "../../platform/parentGate";

/**
 * "For grown-ups" (T12.2, T12.3): the family supporter purchase, behind the parental
 * gate everywhere. Cosmetic perks only. The web uses a Stripe Payment Link; the store
 * apps use the store's in-app purchase through RevenueCat (stores don't allow
 * outside payment links for digital extras).
 */
export default function GrownUpsSection() {
  const { user } = useAuth();
  const supporter = useSupporter();
  const [open, setOpen] = useState(false);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const native = adapters.app.isNative;
  const storeReady =
    native && Boolean(brand.revenueCatAppleKey || brand.revenueCatGoogleKey) && Boolean(user);

  const storeAction = async (kind: "buy" | "restore") => {
    if (!user?.userId || busy) return;
    setBusy(true);
    setStoreMessage(null);
    try {
      const store = await import("../../platform/adapters/nativePurchases");
      if (kind === "buy") {
        if (!(await requestGrownUp())) return;
        const outcome = await store.buySupporter(user.userId);
        setStoreMessage(
          outcome === "purchased"
            ? "Thank you! The extras will appear in a moment."
            : outcome === "cancelled"
              ? null
              : "The store isn't available right now. Please try again later.",
        );
      } else {
        const restored = await store.restorePurchases(user.userId);
        setStoreMessage(restored ? "Purchases restored." : "No purchases to restore.");
      }
      // The webhook records the supporter on our server; give it a moment, then refresh.
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.supporter });
      }, 3000);
    } finally {
      setBusy(false);
    }
  };
  const link = brand.supporterPaymentLink;
  const canBuyHere = Boolean(link) && !native;
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
          {storeReady ? (
            <div className="space-y-2">
              <button
                type="button"
                disabled={busy}
                className="btn btn-primary min-h-11 w-full"
                onClick={() => void storeAction("buy")}
              >
                Become a family supporter
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn btn-outline min-h-11 w-full"
                onClick={() => void storeAction("restore")}
              >
                Restore purchases
              </button>
              {storeMessage && <p aria-live="polite">{storeMessage}</p>}
            </div>
          ) : canBuyHere && checkoutUrl ? (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center"
            >
              Become a family supporter
            </a>
          ) : native ? null : (
            <p>
              You can also support us on Ko-fi from the Support us page, then email us your
              player&apos;s screen name for the thank-you extras.
            </p>
          )}
          <p className="text-xs">
            {native
              ? "Payments are handled by the app store; we never see card details."
              : "Payments are handled by Stripe; we never see card details. The receipt comes to you by email."}
          </p>
        </div>
      )}
    </section>
  );
}
