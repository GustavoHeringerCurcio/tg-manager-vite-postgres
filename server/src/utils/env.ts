export type AppEnv = {
  nodeEnv: string;
  appPort: number;
  domain: string;
  adminPassword: string;
  livepixClientId: string;
  livepixClientSecret: string;
  livepixRedirectUrl: string;
  maxPixGenerations: number;
  interactionRetentionDays: number;
  logPayloads: boolean;
  fbPixelId: string | undefined;
  fbAccessToken: string | undefined;
  fbTestEventCode: string | undefined;
  fbEventsEnabled: boolean;
};

type EnvSource = Record<string, string | undefined>;

const requiredKeys = [
  "DATABASE_URL",
  "DOMAIN",
  "ADMIN_PASSWORD",
  "LIVEPIX_CLIENT_ID",
  "LIVEPIX_CLIENT_SECRET"
] as const;

function required(source: EnvSource, key: (typeof requiredKeys)[number]): string {
  const value = source[key];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function numberValue(source: EnvSource, key: string, fallback: number): number {
  const raw = source[key] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${key} must be numeric`);
  }
  return value;
}

function booleanValue(source: EnvSource, key: string, fallback: boolean): boolean {
  const raw = source[key] ?? String(fallback);
  if (["true", "1", "yes"].includes(raw.toLowerCase())) return true;
  if (["false", "0", "no"].includes(raw.toLowerCase())) return false;
  throw new Error(`Environment variable ${key} must be boolean-like`);
}

export function loadEnv(source: EnvSource = process.env): AppEnv {
  for (const key of requiredKeys) required(source, key);
  const domain = required(source, "DOMAIN");
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    throw new Error("DOMAIN must be a host without protocol");
  }

  return {
    nodeEnv: source.NODE_ENV ?? "development",
    appPort: numberValue(source, "APP_PORT", 3000),
    domain,
    adminPassword: required(source, "ADMIN_PASSWORD"),
    livepixClientId: required(source, "LIVEPIX_CLIENT_ID"),
    livepixClientSecret: required(source, "LIVEPIX_CLIENT_SECRET"),
    livepixRedirectUrl: source.LIVEPIX_REDIRECT_URL ?? `https://t.me/${domain}`,
    maxPixGenerations: numberValue(source, "MAX_PIX_GENERATIONS", 5),
    interactionRetentionDays: numberValue(source, "INTERACTION_RETENTION_DAYS", 90),
    logPayloads: booleanValue(source, "LOG_PAYLOADS", false),
    fbPixelId: source.FB_PIXEL_ID?.trim() || undefined,
    fbAccessToken: source.FB_ACCESS_TOKEN?.trim() || undefined,
    fbTestEventCode: source.FB_TEST_EVENT_CODE?.trim() || undefined,
    fbEventsEnabled: booleanValue(source, "FB_EVENTS_ENABLED", true)
  };
}
