export type BotSettings = {
  timezone?: string;
  language?: string;
  maxDailyPixGenerations?: number;
  resetPixAfterStart?: boolean;
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

  if (typeof value.maxDailyPixGenerations === "number" && Number.isFinite(value.maxDailyPixGenerations) && value.maxDailyPixGenerations > 0) {
    settings.maxDailyPixGenerations = Math.round(value.maxDailyPixGenerations);
  }

  if (typeof value.resetPixAfterStart === "boolean") {
    settings.resetPixAfterStart = value.resetPixAfterStart;
  }

  return settings;
}
