import { randomUUID } from "node:crypto";
import { normalizeMessageFlow, type MessageStep } from "./messageFlow.js";

export type RemarketingConfig = {
  enabled: boolean;
  intervalMs: number;
  initialDelayMs: number;
  maxSends: number;
  messages: MessageStep[];
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
  return {
    enabled,
    intervalMs: Math.round(intervalMs),
    initialDelayMs: Math.round(initialDelayMs),
    maxSends: Math.round(maxSends),
    messages
  };
}

export function defaultRemarketing(): RemarketingConfig {
  return {
    enabled: false,
    intervalMs: 3600000,
    initialDelayMs: 0,
    maxSends: 0,
    messages: []
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
