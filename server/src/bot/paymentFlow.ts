import type { MessageStep } from "./messageFlow.js";
import { normalizeMessageFlow } from "./messageFlow.js";

export type PaymentFlow = {
  steps: MessageStep[];
  verifyLabel: string;
  pixCopyLabel: string;
};

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePaymentFlow(value: unknown): PaymentFlow {
  if (value === undefined || value === null) return defaultPaymentFlow();
  if (Array.isArray(value)) throw new Error("paymentFlow must be an object, got an array");
  if (!isRecord(value)) throw new Error("paymentFlow must be an object");

  const steps = normalizeMessageFlow(value.steps);

  const verifyLabel = cleanString(value.verifyLabel) ?? "Verificar pagamento";
  const pixCopyLabel = cleanString(value.pixCopyLabel) ?? "Copiar PIX";

  return { steps, verifyLabel, pixCopyLabel };
}

export function defaultPaymentFlow(): PaymentFlow {
  return {
    steps: [],
    verifyLabel: "Verificar pagamento",
    pixCopyLabel: "Copiar PIX"
  };
}

export function isPaymentFlowConfigured(flow: PaymentFlow): boolean {
  return flow.steps.length > 0;
}
