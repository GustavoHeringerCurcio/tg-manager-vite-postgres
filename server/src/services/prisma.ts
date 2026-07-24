import { cpus } from "node:os";
import { PrismaClient } from "@prisma/client";

function resolvePoolLimit(): number {
  const raw = process.env.WORKER_COUNT;
  const configured = Number(raw);
  const workers = (Number.isFinite(configured) && configured > 0)
    ? configured
    : (configured === 0 ? cpus().length : 1);
  return Math.min(Math.max(workers * 10, 10), 20);
}

function withPoolConfig(envUrl: string | undefined, limit?: number): string {
  const raw = envUrl ?? "";
  if (!raw) return raw;
  const resolvedLimit = limit ?? resolvePoolLimit();
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", String(resolvedLimit));
      url.searchParams.set("pool_timeout", "10");
    }
    return url.toString();
  } catch {
    const separator = raw.includes("?") ? "&" : "?";
    return `${raw}${separator}connection_limit=${resolvedLimit}&pool_timeout=10`;
  }
}

export const prisma = new PrismaClient({
  datasources: {
    db: { url: withPoolConfig(process.env.DATABASE_URL) }
  }
});

export const analyticsPrisma = new PrismaClient({
  datasources: {
    db: { url: withPoolConfig(process.env.DATABASE_URL, 5) }
  }
});
