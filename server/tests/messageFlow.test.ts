import { describe, expect, it } from "vitest";
import { normalizeMessageFlow } from "../src/bot/messageFlow.js";

describe("normalizeMessageFlow", () => {
  it("accepts text messages with LivePix and URL buttons", () => {
    const flow = normalizeMessageFlow([{ id: "step", title: "Welcome", type: "TEXT", text: "Hi", delayMs: 1500, buttons: [
      { id: "pay", label: "Pay", color: "GREEN", action: "LIVEPIX_PAYMENT", price: 29.9 },
      { id: "support", label: "Support", color: "BLUE", action: "OPEN_URL", url: "https://example.com" }
    ] }]);

    expect(flow[0].buttons).toHaveLength(2);
    expect(flow[0].delayMs).toBe(1500);
    expect(flow[0].buttons[0].price).toBe(29.9);
  });

  it("limits each message to 3 buttons", () => {
    expect(() => normalizeMessageFlow([{ type: "TEXT", text: "Hi", buttons: [
      { label: "One", action: "LIVEPIX_PAYMENT", price: 10 },
      { label: "Two", action: "LIVEPIX_PAYMENT", price: 20 },
      { label: "Three", action: "LIVEPIX_PAYMENT", price: 30 },
      { label: "Four", action: "LIVEPIX_PAYMENT", price: 40 }
    ] }])).toThrow("at most 3 buttons");
  });

  it("requires valid URLs only for URL buttons", () => {
    expect(() => normalizeMessageFlow([{ type: "TEXT", text: "Hi", buttons: [{ label: "Open", action: "OPEN_URL", url: "ftp://example.com" }] }])).toThrow("valid http or https URL");
    expect(normalizeMessageFlow([{ type: "TEXT", text: "Hi", buttons: [{ label: "Pay", action: "LIVEPIX_PAYMENT", price: 19.99 }] }])[0].buttons[0].url).toBeUndefined();
  });
});
