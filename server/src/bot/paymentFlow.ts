import type { MessageStep } from "./messageFlow.js";
import { normalizeMessageFlow } from "./messageFlow.js";

export type PaymentFlow = {
  steps: MessageStep[];
  verifyLabel: string;
  pixCopyLabel: string;
  unpaidAudioFileIds: string[];
  verifyPaymentAudios: string[];
  copyPixAudios: string[];
  isCopyPixAudioEnabled: boolean;
};

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v): v is string => Boolean(v));
}

export function normalizePaymentFlow(value: unknown): PaymentFlow {
  if (value === undefined || value === null) return defaultPaymentFlow();
  if (Array.isArray(value)) throw new Error("paymentFlow must be an object, got an array");
  if (!isRecord(value)) throw new Error("paymentFlow must be an object");

  const steps = normalizeMessageFlow(value.steps);

  const verifyLabel = cleanString(value.verifyLabel) ?? "Verificar pagamento";
  const pixCopyLabel = cleanString(value.pixCopyLabel) ?? "Copiar PIX";
  const unpaidAudioFileIds = normalizeStringArray(value.unpaidAudioFileIds);

  const record = value as Record<string, unknown>;
  const verifyPaymentAudiosRaw = normalizeStringArray(record.verifyPaymentAudios);
  const verifyPaymentAudios = verifyPaymentAudiosRaw.length ? verifyPaymentAudiosRaw : unpaidAudioFileIds;
  const copyPixAudios = normalizeStringArray(record.copyPixAudios);
  const isCopyPixAudioEnabled =
    typeof record.isCopyPixAudioEnabled === "boolean" ? (record.isCopyPixAudioEnabled as boolean) : false;

  return {
    steps,
    verifyLabel,
    pixCopyLabel,
    unpaidAudioFileIds,
    verifyPaymentAudios,
    copyPixAudios,
    isCopyPixAudioEnabled
  };
}

export function defaultPaymentFlow(): PaymentFlow {
  return {
    steps: [],
    verifyLabel: "Verificar pagamento",
    pixCopyLabel: "Copiar PIX",
    unpaidAudioFileIds: [],
    verifyPaymentAudios: [],
    copyPixAudios: [],
    isCopyPixAudioEnabled: false
  };
}

export function isPaymentFlowConfigured(flow: PaymentFlow): boolean {
  return flow.steps.length > 0;
}
