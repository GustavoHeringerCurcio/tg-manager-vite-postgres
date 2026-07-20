import { randomUUID } from "node:crypto";
import { normalizeMessageFlow, type MessageStep } from "./messageFlow.js";

export type DiscountTier = {
  afterMessages: number;
  percentage: number;
};

export type DiscountOfferConfig = {
  enabled: boolean;
  tiers: DiscountTier[];
};

export type RemarketingConfig = {
  enabled: boolean;
  intervalMs: number;
  initialDelayMs: number;
  maxSends: number;
  messages: MessageStep[];
  discountOffer: DiscountOfferConfig;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeRemarketing(value: unknown): RemarketingConfig {
  if (!isRecord(value)) return defaultRemarketing();
  const enabled = typeof value.enabled === "boolean" ? value.enabled : false;
  const intervalMs = Number(value.intervalMs ?? 3600000);
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new Error("remarketing intervalMs must be zero or greater");
  }
  const initialDelayMs = Number(value.initialDelayMs ?? 0);
  if (!Number.isFinite(initialDelayMs) || initialDelayMs < 0) {
    throw new Error("remarketing initialDelayMs must be zero or greater");
  }
  const maxSends = Number(value.maxSends ?? 0);
  if (!Number.isFinite(maxSends) || maxSends < 0 || !Number.isInteger(maxSends)) {
    throw new Error("remarketing maxSends must be a non-negative integer");
  }
  const messages = normalizeMessageFlow(value.messages);
  const discountOffer = normalizeDiscountOffer(value.discountOffer);
  return {
    enabled,
    intervalMs: Math.round(intervalMs),
    initialDelayMs: Math.round(initialDelayMs),
    maxSends: Math.round(maxSends),
    messages,
    discountOffer
  };
}

function normalizeDiscountOffer(value: unknown): DiscountOfferConfig {
  if (!isRecord(value)) return defaultDiscountOffer();
  const enabled = typeof value.enabled === "boolean" ? value.enabled : false;
  const tiers = normalizeDiscountTiers(value.tiers);
  return { enabled, tiers };
}

function normalizeDiscountTiers(value: unknown): DiscountTier[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const result: DiscountTier[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const afterMessages = Number(item.afterMessages ?? 0);
    if (!Number.isFinite(afterMessages) || afterMessages < 1 || !Number.isInteger(afterMessages)) continue;
    const percentage = Number(item.percentage ?? 0);
    if (!Number.isFinite(percentage) || percentage < 1 || percentage > 99) continue;
    if (seen.has(afterMessages)) continue;
    seen.add(afterMessages);
    result.push({ afterMessages: Math.round(afterMessages), percentage: Math.round(percentage) });
  }
  result.sort((a, b) => a.afterMessages - b.afterMessages);
  return result;
}

export function defaultDiscountOffer(): DiscountOfferConfig {
  return {
    enabled: false,
    tiers: []
  };
}

export function getDiscountPercentage(config: DiscountOfferConfig, totalSent: number): number {
  if (!config.enabled || config.tiers.length === 0) return 0;
  let best: DiscountTier | null = null;
  for (const tier of config.tiers) {
    if (totalSent >= tier.afterMessages) {
      if (!best || tier.afterMessages > best.afterMessages) {
        best = tier;
      }
    }
  }
  return best ? best.percentage : 0;
}

export function defaultRemarketing(): RemarketingConfig {
  return {
    enabled: false,
    intervalMs: 3600000,
    initialDelayMs: 0,
    maxSends: 0,
    messages: [],
    discountOffer: defaultDiscountOffer()
  };
}

export function defaultRemarketingMessage(index: number): MessageStep {
  return {
    id: randomUUID(),
    title: `Remarketing ${index + 1}`,
    type: "VIDEO",
    text: "",
    mediaUrls: [],
    delayMs: 0,
    buttons: []
  };
}
