import { prisma } from "../services/prisma.js";
import { logger } from "../utils/logger.js";

export type GlobalConfig = {
  callbackCooldownMs: number;
  telegramRateLimit: number;
  telegramRateBurst: number;
  defaultMaxPixGenerations: number;
  paymentPollWindowMinutes: number;
  interactionRetentionDays: number;
  userCacheTtlMs: number;
  userCacheMaxSize: number;
};

const GLOBAL_CONFIG_ID = "global";

const DEFAULTS: GlobalConfig = {
  callbackCooldownMs: 7_000,
  telegramRateLimit: 25,
  telegramRateBurst: 30,
  defaultMaxPixGenerations: 5,
  paymentPollWindowMinutes: 30,
  interactionRetentionDays: 90,
  userCacheTtlMs: 60_000,
  userCacheMaxSize: 10_000,
};

let cachedConfig: GlobalConfig = { ...DEFAULTS };
let loaded = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isInteger(value)) {
    return value;
  }
  return undefined;
}

export function normalizeGlobalConfig(value: unknown): GlobalConfig {
  const config: GlobalConfig = { ...DEFAULTS };

  if (!isRecord(value)) return config;

  const cooldown = validInt(value.callbackCooldownMs);
  if (cooldown) config.callbackCooldownMs = cooldown;

  const rateLimit = validInt(value.telegramRateLimit);
  if (rateLimit) config.telegramRateLimit = rateLimit;

  const rateBurst = validInt(value.telegramRateBurst);
  if (rateBurst) config.telegramRateBurst = rateBurst;

  const maxPix = validInt(value.defaultMaxPixGenerations);
  if (maxPix) config.defaultMaxPixGenerations = maxPix;

  const pollWindow = validInt(value.paymentPollWindowMinutes);
  if (pollWindow) config.paymentPollWindowMinutes = pollWindow;

  const retention = validInt(value.interactionRetentionDays);
  if (retention) config.interactionRetentionDays = retention;

  const cacheTtl = validInt(value.userCacheTtlMs);
  if (cacheTtl) config.userCacheTtlMs = cacheTtl;

  const cacheSize = validInt(value.userCacheMaxSize);
  if (cacheSize) config.userCacheMaxSize = cacheSize;

  return config;
}

export async function loadGlobalConfig(): Promise<GlobalConfig> {
  try {
    const row = await prisma.globalConfig.findUnique({ where: { id: GLOBAL_CONFIG_ID } });
    const raw = (row?.settings ?? {}) as unknown;
    cachedConfig = normalizeGlobalConfig(raw);
  } catch (error) {
    logger.error("failed to load global config from db, using defaults", error instanceof Error ? error.message : error);
    cachedConfig = { ...DEFAULTS };
  }
  loaded = true;
  return cachedConfig;
}

export async function updateGlobalConfig(raw: unknown): Promise<GlobalConfig> {
  const normalized = normalizeGlobalConfig(raw);
  await prisma.globalConfig.upsert({
    where: { id: GLOBAL_CONFIG_ID },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { id: GLOBAL_CONFIG_ID, settings: normalized as any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { settings: normalized as any },
  });
  cachedConfig = normalized;
  logger.info("global config updated");
  return cachedConfig;
}

export function getGlobalConfig(): GlobalConfig {
  if (!loaded) {
    logger.warn("global config accessed before load, returning defaults");
    return { ...DEFAULTS };
  }
  return cachedConfig;
}
