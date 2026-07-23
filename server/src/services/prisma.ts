import { PrismaClient } from "@prisma/client";

function withPoolConfig(envUrl: string | undefined): string {
  const raw = envUrl ?? "";
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "20");
      url.searchParams.set("pool_timeout", "10");
    }
    return url.toString();
  } catch {
    const separator = raw.includes("?") ? "&" : "?";
    return `${raw}${separator}connection_limit=20&pool_timeout=10`;
  }
}

export const prisma = new PrismaClient({
  datasources: {
    db: { url: withPoolConfig(process.env.DATABASE_URL) }
  }
});
