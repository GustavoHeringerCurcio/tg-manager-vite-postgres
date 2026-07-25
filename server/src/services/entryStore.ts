import { randomBytes } from "node:crypto";

interface EntryRecord {
  utm: Record<string, string>;
  expires: number;
}

const entries = new Map<string, EntryRecord>();

const TTL_MS = 3600_000;

setInterval(() => {
  const now = Date.now();
  for (const [token, record] of entries) {
    if (record.expires < now) entries.delete(token);
  }
}, 300_000).unref();

export function storeEntry(utm: Record<string, string>): string {
  const token = randomBytes(4).toString("hex");
  entries.set(token, { utm, expires: Date.now() + TTL_MS });
  return token;
}

export function getEntry(token: string): Record<string, string> | null {
  const entry = entries.get(token);
  if (!entry || entry.expires < Date.now()) {
    entries.delete(token);
    return null;
  }
  return entry.utm;
}
