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

export function normalizePaymentFlow(value: unknown): PaymentFlow {
  if (value === undefined || value === null) return defaultPaymentFlow();
  if (Array.isArray(value)) throw new Error("paymentFlow must be an object, got an array");
  if (!isRecord(value)) throw new Error("paymentFlow must be an object");

  // Normalize steps and ensure the new "isActive" flag defaults to true when missing.
  const rawSteps = normalizeMessageFlow(value.steps);
  const steps = rawSteps.map((s) => ({ ...s, isActive: typeof (s as any).isActive === "boolean" ? (s as any).isActive : true }));

  const verifyLabel = cleanString(value.verifyLabel) ?? "Verificar pagamento";
  const pixCopyLabel = cleanString(value.pixCopyLabel) ?? "Copiar PIX";

  const record = value as Record<string, unknown>;

  const verifyPaymentSuccessFlow = normalizeMessageFlow(record.verifyPaymentSuccessFlow).map((s) => ({ ...s, isActive: typeof (s as any).isActive === "boolean" ? (s as any).isActive : true }));
  const verifyPaymentFailFlow = normalizeMessageFlow(record.verifyPaymentFailFlow).map((s) => ({ ...s, isActive: typeof (s as any).isActive === "boolean" ? (s as any).isActive : true }));
  const copyPixFlow = normalizeMessageFlow(record.copyPixFlow).map((s) => ({ ...s, isActive: typeof (s as any).isActive === "boolean" ? (s as any).isActive : true }));

  const deliverables = normalizeMessageFlow(record.deliverables).map((s) => ({ ...s, isActive: typeof (s as any).isActive === "boolean" ? (s as any).isActive : true }));

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
  // Consider the flow configured only if there is at least one active step.
  return flow.steps.some((s) => (s as any).isActive !== false);
}

// Helper: return only active steps (treat missing isActive as true)
export function filterActiveSteps(steps: MessageStep[]): MessageStep[] {
  return steps.filter((s) => (s as any).isActive !== false);
}
