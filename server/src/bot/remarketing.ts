import { randomUUID } from "node:crypto";
import { normalizeMessageFlow, type MessageStep } from "./messageFlow.js";

export type DiscountTier = {
  afterMessages: number;
  percentage: number;
};

export type DiscountOfferConfig = {
  enabled: boolean;
  tiers: DiscountTier[];
  labelTemplate: string;
  showOriginalPrice: boolean;
};

export const DEFAULT_LABEL_TEMPLATE = "{label} - R${discount_price} ({discount_percentage}% OFF)";

export type RemarketingConfig = {
  enabled: boolean;
  intervalMs: number;
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
  const intervalMs = Number(value.intervalMs ?? 86400000);
  if (!Number.isFinite(intervalMs) || intervalMs < 0) {
    throw new Error("remarketing intervalMs must be zero or greater");
  }
  if (enabled && intervalMs < 60000) {
    throw new Error("remarketing intervalMs must be at least 60000 (1 minute) when remarketing is enabled");
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
    maxSends: Math.round(maxSends),
    messages,
    discountOffer
  };
}

function normalizeDiscountOffer(value: unknown): DiscountOfferConfig {
  if (!isRecord(value)) return defaultDiscountOffer();
  const enabled = typeof value.enabled === "boolean" ? value.enabled : false;
  const tiers = normalizeDiscountTiers(value.tiers);
  const labelTemplate = typeof value.labelTemplate === "string" && value.labelTemplate.trim() ? value.labelTemplate.trim() : DEFAULT_LABEL_TEMPLATE;
  const showOriginalPrice = typeof value.showOriginalPrice === "boolean" ? value.showOriginalPrice : true;
  return { enabled, tiers, labelTemplate, showOriginalPrice };
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
    tiers: [],
    labelTemplate: DEFAULT_LABEL_TEMPLATE,
    showOriginalPrice: true
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

export type DiscountLabelParams = {
  label: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  firstName: string | null;
  timezone: string;
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stripPriceFromLabel(label: string, price: number): string {
  const priceDot = price.toFixed(2);
  const priceComma = priceDot.replace('.', ',');

  const patterns = [
    `\\s*(de|por)\\s+R\\$\\s*${escapeRegex(priceDot)}\\s*$`,
    `\\s*(de|por)\\s+R\\$\\s*${escapeRegex(priceComma)}\\s*$`,
    `\\s+R\\$\\s*${escapeRegex(priceDot)}\\s*$`,
    `\\s+R\\$\\s*${escapeRegex(priceComma)}\\s*$`,
    `\\s+-\\s+R\\$\\s*${escapeRegex(priceDot)}\\s*$`,
    `\\s+-\\s+R\\$\\s*${escapeRegex(priceComma)}\\s*$`,
  ];

  for (const p of patterns) {
    const regex = new RegExp(p, 'i');
    label = label.replace(regex, '').trim();
  }

  return label.trim();
}

export function resolveDiscountLabel(template: string, params: DiscountLabelParams, showOriginalPrice: boolean = true): string {
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: params.timezone,
    hour: "2-digit",
    minute: "2-digit"
  });
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: params.timezone
  });

  const label = params.originalPrice > 0
    ? stripPriceFromLabel(params.label, params.originalPrice)
    : params.label;

  let result = template
    .replace(/\{label\}/g, label)
    .replace(/\{original_price\}/g, showOriginalPrice ? params.originalPrice.toFixed(2) : '')
    .replace(/\{discount_price\}/g, params.discountedPrice.toFixed(2))
    .replace(/\{discount_percentage\}/g, String(params.discountPercentage))
    .replace(/\{name\}/g, params.firstName ?? "")
    .replace(/\{time\}/g, timeFormatter.format(now))
    .replace(/\{data\}/g, dateFormatter.format(now));

  if (!showOriginalPrice) {
    result = result.replace(/~~/g, '').replace(/\s{2,}/g, ' ');
  }

  return result.trim();
}

export function defaultRemarketing(): RemarketingConfig {
  return {
    enabled: false,
    intervalMs: 86400000,
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

export type TimeComplimentPreset = {
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export type TimeComplimentConfig = {
  timezone: string;
  fallback: string;
  presets: TimeComplimentPreset[];
};

function isValidHour(value: number): value is number {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 23;
}

function isValidMinute(value: number): value is number {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 59;
}

function normalizeTimeComplimentPreset(value: unknown, index: number): TimeComplimentPreset | null {
  if (!isRecord(value)) return null;
  const label = cleanString(value.label);
  if (!label) return null;
  const startHour = Number(value.startHour);
  const startMinute = Number(value.startMinute);
  const endHour = Number(value.endHour);
  const endMinute = Number(value.endMinute);
  if (!isValidHour(startHour) || !isValidMinute(startMinute)) return null;
  if (!isValidHour(endHour) || !isValidMinute(endMinute)) return null;
  return { label, startHour, startMinute, endHour, endMinute };
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeTimeCompliments(value: unknown, botTimezone?: string): TimeComplimentConfig {
  if (!isRecord(value)) return defaultTimeCompliments(botTimezone);
  const timezone = cleanString(value.timezone) ?? botTimezone ?? "America/Sao_Paulo";
  const fallback = cleanString(value.fallback) ?? "";
  const rawPresets = value.presets;
  const presets: TimeComplimentPreset[] = [];
  if (Array.isArray(rawPresets)) {
    for (let i = 0; i < rawPresets.length; i++) {
      const preset = normalizeTimeComplimentPreset(rawPresets[i], i);
      if (preset) presets.push(preset);
    }
  }
  return { timezone, fallback, presets };
}

export function defaultTimeCompliments(botTimezone?: string): TimeComplimentConfig {
  return {
    timezone: botTimezone ?? "America/Sao_Paulo",
    fallback: "",
    presets: []
  };
}
