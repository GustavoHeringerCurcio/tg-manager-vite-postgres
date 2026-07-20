import type { LivePixResponse } from "./messageFlow.js";

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateUrl(value: string | undefined, field: string): string {
  if (!value) throw new Error(`${field} is required`);
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid URL protocol");
    return value;
  } catch {
    throw new Error(`${field} must be a valid http or https URL`);
  }
}

function normalizeResponse(value: unknown, index: number): LivePixResponse {
  if (!isRecord(value)) throw new Error(`response ${index + 1} must be an object`);
  const text = cleanString(value.text);
  const imageUrl = cleanString(value.imageUrl);
  const audioUrl = cleanString(value.audioUrl);
  const videoUrl = cleanString(value.videoUrl);
  if (imageUrl) validateUrl(imageUrl, `response ${index + 1} imageUrl`);
  if (audioUrl) validateUrl(audioUrl, `response ${index + 1} audioUrl`);
  if (videoUrl) validateUrl(videoUrl, `response ${index + 1} videoUrl`);
  return {
    ...(text ? { text } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    includeQrCode: typeof value.includeQrCode === "boolean" ? value.includeQrCode : undefined,
    includePixCode: typeof value.includePixCode === "boolean" ? value.includePixCode : undefined,
    includeCheckoutUrl: typeof value.includeCheckoutUrl === "boolean" ? value.includeCheckoutUrl : undefined
  };
}

export function normalizePaymentFlow(value: unknown): LivePixResponse[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("paymentFlow must be an array");
  return value.map((item, index) => normalizeResponse(item, index));
}

export function defaultPaymentFlow(): LivePixResponse[] {
  return [];
}
