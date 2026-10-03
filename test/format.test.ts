import { describe, expect, it } from "vitest";
import { cardToTelnyxText, truncateTelnyxText } from "../src/format";

describe("text formatting", () => {
  it("passes short text through unchanged", () => {
    expect(truncateTelnyxText("hello", { limit: 10 })).toEqual({
      text: "hello",
      truncated: false,
    });
  });

  it("truncates beyond the limit", () => {
    expect(truncateTelnyxText("hello world", { limit: 5 })).toEqual({
      text: "hello",
      truncated: true,
    });
  });

  it("rejects invalid limits", () => {
    expect(() => truncateTelnyxText("hello", { limit: 0 })).toThrow();
  });
});

describe("card rendering", () => {
  it("renders a card to plain text", () => {
    const card = {
      children: [{ content: "Body text", type: "text" }],
      title: "Greeting",
      type: "card",
    };
    expect(cardToTelnyxText(card as never)).toContain("Body text");
  });
});
