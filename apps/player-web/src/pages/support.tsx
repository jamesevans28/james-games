import InfoPage, { ContactEmail, InfoList, InfoSection } from "../components/InfoPage";
import { brand, makersLine } from "../config/brand";
import { COSTS, COSTS_UPDATED, totalPerYear } from "../config/costs";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

/**
 * Support us (T12.1): who makes the games, what it costs, and a Ko-fi link for
 * grown-ups. Never on the game canvas, never an overlay. In the native apps the
 * link goes behind the parental gate (T10.7).
 */
export default function SupportPage() {
  return (
    <InfoPage
      path="/support"
      title="Support us"
      description={`${brand.name} is made by ${makersLine()}. No ads, ever. If you'd like to help with the running costs, you can support us on Ko-fi.`}
      intro={
        <p>
          {brand.name} is made at our kitchen table by {makersLine()}. The games are free and there
          are no ads. If a grown-up would like to help pay for running it, that would make our day.
        </p>
      }
    >
      <InfoSection title="Where the money goes">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Running costs per year</caption>
          <thead className="text-ink-2">
            <tr>
              <th scope="col" className="py-1 font-bold">
                What
              </th>
              <th scope="col" className="py-1 text-right font-bold">
                Per year
              </th>
            </tr>
          </thead>
          <tbody>
            {COSTS.map((row) => (
              <tr key={row.item} className="border-t border-line">
                <td className="py-2 pr-2">
                  <span className="font-semibold">{row.item}</span>
                  <span className="block text-ink-2">{row.note}</span>
                </td>
                <td className="py-2 text-right tabular-nums">{aud.format(row.perYear)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-edge font-extrabold">
              <td className="py-2">About</td>
              <td className="py-2 text-right tabular-nums">{aud.format(totalPerYear())}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-sm text-ink-2">Last checked {COSTS_UPDATED}.</p>
      </InfoSection>

      <InfoSection title="What it isn’t">
        <InfoList>
          <li>No ads, ever.</li>
          <li>Nothing a kid can buy. Supporting is for grown-ups, on Ko-fi&rsquo;s own page.</li>
          <li>
            No extra lives or high-score boosts for supporters. Everyone plays the same games.
          </li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Grown-ups: support us on Ko-fi">
        <p>
          Ko-fi handles the payment, so we never see card details. You&rsquo;ll get a receipt from
          them by email.
        </p>
        <a
          href={brand.supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center py-3.5"
        >
          Support us on Ko-fi
        </a>
        <p className="text-sm text-ink-2">
          If you tell us your player&rsquo;s screen name when you support us (
          <ContactEmail subject={`Supporter: ${brand.name}`} />
          ), we&rsquo;ll give them a &ldquo;Supporter&rdquo; sticker as a thank you.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
