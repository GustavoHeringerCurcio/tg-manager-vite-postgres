import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function normalizeKey(rawKey: string): Buffer {
  const trimmed = rawKey.trim();
  const hex = /^[a-f0-9]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : undefined;
  const base64 = /^[A-Za-z0-9+/=]+$/.test(trimmed) ? Buffer.from(trimmed, "base64") : undefined;
  const utf8 = Buffer.from(trimmed, "utf8");
  const key = hex?.length === 32 ? hex : base64?.length === 32 ? base64 : utf8;
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must resolve to exactly 32 bytes. Use a 64-character hex string (e.g. from `openssl rand -hex 32`) or exactly 32 ASCII characters."
    );
  }
  return key;
}

export function encryptToken(token: string, encryptionKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeKey(encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptToken(encryptedToken: string, encryptionKey: string): string {
  const parts = encryptedToken.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivRaw, tagRaw, encryptedRaw] = parts;
  const decipher = createDecipheriv("aes-256-gcm", normalizeKey(encryptionKey), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
