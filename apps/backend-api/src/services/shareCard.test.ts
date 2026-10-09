import { expect, test } from "vitest";
import {
  buildMissingShareHtml,
  buildShareHtml,
  escapeHtml,
  formatScore,
  parseSharePlayId,
  shareCardFor,
  shareHeadline,
  type ShareCard,
} from "./shareCard.js";
import type { SharePlayRow } from "../repos/shareRepo.js";

const ID = "3f2b8c1e-7a4d-4c6b-9e2f-1a2b3c4d5e6f";

const row: SharePlayRow = {
  playId: ID,
  gameId: "snapadile",
  gameTitle: "Snapadile",
  gameStatus: "active",
  score: 120,
  screenName: "Tilly",
  disabled: false,
  remixName: null,
};

const card = (over: Partial<ShareCard> = {}): ShareCard => ({ ...shareCardFor(row)!, ...over });

test("play ids must look like UUIDs", () => {
  expect(parseSharePlayId(ID.toUpperCase())).toBe(ID);
  expect(parseSharePlayId("123")).toBeNull();
  expect(parseSharePlayId(`${ID}.png`)).toBeNull();
  expect(parseSharePlayId("../../etc/passwd")).toBeNull();
});

test("the card shows the screen name, or 'A player' for deleted and disabled accounts", () => {
  expect(shareHeadline(card())).toBe("Tilly scored 120 on Snapadile!");
  expect(shareHeadline(shareCardFor({ ...row, screenName: null })!)).toBe(
    "A player scored 120 on Snapadile!",
  );
  expect(shareCardFor({ ...row, disabled: true })!.playerName).toBeNull();
});

test("inactive games have no card; beta games do", () => {
  expect(shareCardFor({ ...row, gameStatus: "inactive" })).toBeNull();
  expect(shareCardFor({ ...row, gameStatus: "beta" })).not.toBeNull();
});

test("remix plays name the remix", () => {
  const remix = shareCardFor({ ...row, remixName: "Super-fast crocs" })!;
  expect(shareHeadline(remix)).toBe("Tilly scored 120 on Super-fast crocs, a Snapadile remix!");
});

test("scores get thousands separators", () => {
  expect(formatScore(0)).toBe("0");
  expect(formatScore(999)).toBe("999");
  expect(formatScore(12000)).toBe("12,000");
  expect(formatScore(1234567)).toBe("1,234,567");
});

test("the page carries the og and twitter tags and sends people to the game", () => {
  const html = buildShareHtml(card(), "https://games4james.com/");
  expect(html).toContain('<meta property="og:title" content="Tilly scored 120 on Snapadile!">');
  expect(html).toContain('<meta property="og:description" content="Can you beat it?">');
  expect(html).toContain(
    `<meta property="og:image" content="https://games4james.com/s/${ID}.png">`,
  );
  expect(html).toContain(`<meta property="og:url" content="https://games4james.com/s/${ID}">`);
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).toContain('location.replace("https://games4james.com/games/snapadile")');
  expect(html).not.toContain("http-equiv");
});

test("names are escaped everywhere they appear", () => {
  const nasty = "<script>alert(\"x\")</script> & 'quotes'";
  const html = buildShareHtml(
    card({ playerName: nasty, remixName: "</script><b>" }),
    "https://x.test",
  );
  expect(html).not.toContain("<script>alert");
  expect(html).not.toContain("</script><b>");
  expect(html).toContain(
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;",
  );
  // Exactly one script element: the redirect.
  expect(html.match(/<script>/g)).toHaveLength(1);
  expect(escapeHtml(`"'<>&`)).toBe("&quot;&#39;&lt;&gt;&amp;");
});

test("a missing card sends people home", () => {
  const html = buildMissingShareHtml("https://games4james.com");
  expect(html).toContain('location.replace("https://games4james.com/")');
  expect(html).toContain("noindex");
});
