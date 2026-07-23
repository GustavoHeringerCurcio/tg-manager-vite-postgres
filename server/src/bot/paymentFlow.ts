import { randomUUID } from "node:crypto";
import type { MessageStep } from "./messageFlow.js";
import { normalizeMessageFlow } from "./messageFlow.js";

export type PaymentFlow = {
  steps: MessageStep[];
  verifyLabel: string;
  pixCopyLabel: string;
  verifyPaymentSuccessFlow: MessageStep[];
  verifyPaymentFailFlow: MessageStep[];
  copyPixFlow: MessageStep[];
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

function audioStepFromFileId(fileId: string, title: string): MessageStep {
  return {
    id: randomUUID(),
    title,
    type: "AUDIO",
    text: undefined,
    mediaUrls: [fileId],
    delayMs: 0,
    buttons: [],
    dailyAudios: undefined,
  };
}

export function normalizePaymentFlow(value: unknown): PaymentFlow {
  if (value === undefined || value === null) return defaultPaymentFlow();
  if (Array.isArray(value)) throw new Error("paymentFlow must be an object, got an array");
  if (!isRecord(value)) throw new Error("paymentFlow must be an object");

  const steps = normalizeMessageFlow(value.steps);

  const verifyLabel = cleanString(value.verifyLabel) ?? "Verificar pagamento";
  const pixCopyLabel = cleanString(value.pixCopyLabel) ?? "Copiar PIX";

  const record = value as Record<string, unknown>;

  let verifyPaymentSuccessFlow = normalizeMessageFlow(record.verifyPaymentSuccessFlow);
  let verifyPaymentFailFlow = normalizeMessageFlow(record.verifyPaymentFailFlow);
  let copyPixFlow = normalizeMessageFlow(record.copyPixFlow);

  if (verifyPaymentSuccessFlow.length === 0) {
    const successAudios = normalizeStringArray(record.verifyPaymentSuccessAudios);
    if (successAudios.length > 0) {
      verifyPaymentSuccessFlow = successAudios.map((fileId) =>
        audioStepFromFileId(fileId, "Pagamento confirmado")
      );
    }
  }

  if (verifyPaymentFailFlow.length === 0) {
    const failAudiosRaw = normalizeStringArray(record.verifyPaymentFailAudios);
    const failAudiosLegacy = normalizeStringArray(record.verifyPaymentAudios);
    const unpaidLegacy = normalizeStringArray(record.unpaidAudioFileIds);
    const failAudios =
      failAudiosRaw.length
        ? failAudiosRaw
        : failAudiosLegacy.length
          ? failAudiosLegacy
          : unpaidLegacy;
    if (failAudios.length > 0) {
      verifyPaymentFailFlow = failAudios.map((fileId) =>
        audioStepFromFileId(fileId, "Pagamento não identificado")
      );
    }
  }

  if (copyPixFlow.length === 0) {
    const copyAudios = normalizeStringArray(record.copyPixAudios);
    if (copyAudios.length > 0) {
      copyPixFlow = copyAudios.map((fileId) =>
        audioStepFromFileId(fileId, "Áudio copy-pix")
      );
    }
  }

  const deliverables = normalizeMessageFlow(record.deliverables);

  return {
    steps,
    verifyLabel,
    pixCopyLabel,
    verifyPaymentSuccessFlow,
    verifyPaymentFailFlow,
    copyPixFlow,
    deliverables,
  };
}

export function defaultPaymentFlow(): PaymentFlow {
  return {
    steps: [],
    verifyLabel: "Verificar pagamento",
    pixCopyLabel: "Copiar PIX",
    verifyPaymentSuccessFlow: [],
    verifyPaymentFailFlow: [],
    copyPixFlow: [],
    deliverables: [],
  };
}

export function isPaymentFlowConfigured(flow: PaymentFlow): boolean {
  return flow.steps.length > 0;
}
