import type { Bot } from "@prisma/client";

export type SafeBot = Omit<Bot, "token" | "fbAccessToken" | "utmifyApiToken">;

export function serializeJson<T>(value: T): T {
  return value;
}

export function sanitizeBot<T extends Bot>(bot: T): Omit<T, "token" | "fbAccessToken" | "utmifyApiToken"> {
  const { token: _token, fbAccessToken: _fbAccessToken, utmifyApiToken: _utmifyApiToken, ...safeBot } = bot;
  return safeBot;
}

export function sanitizeBots<T extends Bot>(bots: T[]): Array<Omit<T, "token" | "fbAccessToken" | "utmifyApiToken">> {
  return bots.map((bot) => sanitizeBot(bot));
}

export type Pagination = { page: number; pageSize: number; skip: number; take: number };

export function parsePagination(query: Record<string, string | undefined>): Pagination {
  const page = Math.max(Number(query.page ?? "1"), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? "20"), 1), 100);
  if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
    throw new Error("Invalid pagination parameters");
  }
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
