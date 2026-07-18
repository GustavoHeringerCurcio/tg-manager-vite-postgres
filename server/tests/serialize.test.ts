import { describe, expect, it } from "vitest";
import { serializeJson } from "../src/utils/serialize.js";

describe("serializeJson", () => {
  it("serializes BigInt as string", () => {
    expect(serializeJson({ telegramId: BigInt(123) })).toEqual({ telegramId: "123" });
  });
});
