import { test, expect } from "vitest";
import { brand } from "../../../config/brand";
import { shareDataFor, shareLinkFor } from "./shareScore";

const ID = "3f2b8c1e-7a4d-4c6b-9e2f-1a2b3c4d5e6f";

test("the link is the public site's /s/<playId>", () => {
  expect(shareLinkFor(ID)).toBe(`${brand.origin}/s/${ID}`);
  expect(shareLinkFor("a/b")).toBe(`${brand.origin}/s/a%2Fb`);
});

test("the share text names the score and the game", () => {
  expect(shareDataFor({ playId: ID, score: 120, gameTitle: "Snapadile" })).toEqual({
    title: `Snapadile on ${brand.name}`,
    text: "I scored 120 on Snapadile! Can you beat it?",
    url: `${brand.origin}/s/${ID}`,
  });
  expect(shareDataFor({ playId: ID, score: 5 }).text).toBe("I scored 5! Can you beat it?");
});
