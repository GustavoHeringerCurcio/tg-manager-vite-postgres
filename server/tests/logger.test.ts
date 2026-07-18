import { describe, expect, it } from "vitest";
import { truncateContent } from "../src/services/logger.js";

describe("truncateContent", () => {
  it("truncates content to 500 characters", () => {
    expect(truncateContent("x".repeat(600))?.length).toBe(500);
  });
});
