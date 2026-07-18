import { describe, expect, it } from "vitest";
import { extractCheckoutId } from "../src/services/livepix.js";

describe("extractCheckoutId", () => {
  it("extracts checkout id from LivePix URL", () => {
    expect(extractCheckoutId("https://checkout.livepix.gg/61021c7bdabe5e001225b65b")).toBe("61021c7bdabe5e001225b65b");
  });
});
