import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "../src/services/crypto.js";

describe("token encryption", () => {
  it("encrypts and decrypts tokens", () => {
    const key = "12345678901234567890123456789012";
    const encrypted = encryptToken("telegram-token", key);
    expect(encrypted).not.toBe("telegram-token");
    expect(decryptToken(encrypted, key)).toBe("telegram-token");
  });
});
