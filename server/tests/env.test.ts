import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/utils/env.js";

const baseEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DOMAIN: "example.com",
  ADMIN_PASSWORD: "secret",
  ENCRYPTION_KEY: "12345678901234567890123456789012",
  LIVEPIX_CLIENT_ID: "client",
  LIVEPIX_CLIENT_SECRET: "secret"
};

describe("loadEnv", () => {
  it("loads defaults", () => {
    const env = loadEnv(baseEnv);
    expect(env.appPort).toBe(3000);
    expect(env.maxPixGenerations).toBe(5);
    expect(env.logPayloads).toBe(false);
  });

  it("rejects protocol in DOMAIN", () => {
    expect(() => loadEnv({ ...baseEnv, DOMAIN: "https://example.com" })).toThrow("DOMAIN");
  });
});
