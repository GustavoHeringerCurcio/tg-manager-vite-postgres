export type BotSettings = {
  timezone?: string;
  language?: string;
  maxDailyPixGenerations?: number;
  resetPixAfterStart?: boolean;
  adminTelegramIds?: string[];
  hideAdminFromDashboard?: boolean;
};

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeBotSettings(value: unknown): BotSettings {
  if (!isRecord(value)) return {};

  const settings: BotSettings = {};

  const timezone = cleanString(value.timezone);
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
      settings.timezone = timezone;
    } catch {
      // invalid timezone, ignore
    }
  }

  const language = cleanString(value.language);
  if (language) settings.language = language;

  const rawMax = value.maxDailyPixGenerations;
  if (typeof rawMax === "number" && Number.isFinite(rawMax) && rawMax > 0) {
    settings.maxDailyPixGenerations = Math.round(rawMax);
  } else {
    settings.maxDailyPixGenerations = 5;
  }

  if (typeof value.resetPixAfterStart === "boolean") {
    settings.resetPixAfterStart = value.resetPixAfterStart;
  }

  if (typeof value.hideAdminFromDashboard === "boolean") {
    settings.hideAdminFromDashboard = value.hideAdminFromDashboard;
  }

  if (Array.isArray(value.adminTelegramIds)) {
    const ids = (value.adminTelegramIds as unknown[]).filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0 && /^\d+$/.test(id.trim())
    ).map(id => id.trim());
    if (ids.length > 0) settings.adminTelegramIds = ids;
  }

  return settings;
}
