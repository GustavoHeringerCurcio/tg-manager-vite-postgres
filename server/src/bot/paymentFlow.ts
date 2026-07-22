import type { MessageStep } from "./messageFlow.js";
import { normalizeMessageFlow } from "./messageFlow.js";

export type PaymentFlow = {
  steps: MessageStep[];
  verifyLabel: string;
  pixCopyLabel: string;
  unpaidAudioFileIds: string[];
  verifyPaymentFailAudios: string[];
  verifyPaymentSuccessAudios: string[];
  isVerifyPaymentAudioEnabled: boolean;
  copyPixAudios: string[];
  isCopyPixAudioEnabled: boolean;
  deliverables: MessageStep[];
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

  const verifyPaymentFailAudiosRaw = normalizeStringArray(record.verifyPaymentFailAudios);
  const verifyPaymentAudiosLegacy = normalizeStringArray(record.verifyPaymentAudios);
  const verifyPaymentFailAudios =
    verifyPaymentFailAudiosRaw.length
      ? verifyPaymentFailAudiosRaw
      : verifyPaymentAudiosLegacy.length
        ? verifyPaymentAudiosLegacy
        : unpaidAudioFileIds;

  const verifyPaymentSuccessAudios = normalizeStringArray(record.verifyPaymentSuccessAudios);

  const isVerifyPaymentAudioEnabled =
    typeof record.isVerifyPaymentAudioEnabled === "boolean" ? (record.isVerifyPaymentAudioEnabled as boolean) : false;

  const copyPixAudios = normalizeStringArray(record.copyPixAudios);
  const isCopyPixAudioEnabled =
    typeof record.isCopyPixAudioEnabled === "boolean" ? (record.isCopyPixAudioEnabled as boolean) : false;

  const deliverables = normalizeMessageFlow(record.deliverables);

  return {
    steps,
    verifyLabel,
    pixCopyLabel,
    unpaidAudioFileIds,
    verifyPaymentFailAudios,
    verifyPaymentSuccessAudios,
    isVerifyPaymentAudioEnabled,
    copyPixAudios,
    isCopyPixAudioEnabled,
    deliverables
  };
}

export function defaultPaymentFlow(): PaymentFlow {
  return {
    steps: [],
    verifyLabel: "Verificar pagamento",
    pixCopyLabel: "Copiar PIX",
    unpaidAudioFileIds: [],
    verifyPaymentFailAudios: [],
    verifyPaymentSuccessAudios: [],
    isVerifyPaymentAudioEnabled: false,
    copyPixAudios: [],
    isCopyPixAudioEnabled: false,
    deliverables: []
  };
}

export function isPaymentFlowConfigured(flow: PaymentFlow): boolean {
  return flow.steps.length > 0;
}
