import type { ButtonAction, MessageButton, MessageStep } from "@/types";

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function newButton(action: ButtonAction = "OPEN_URL"): MessageButton {
  const base: MessageButton = {
    id: newId(),
    label: action === "LIVEPIX_PAYMENT" ? "Pagar agora" : "Abrir link",
    color: action === "LIVEPIX_PAYMENT" ? "GREEN" : "BLUE",
    action,
    url: "",
  };
  if (action === "LIVEPIX_PAYMENT") {
    base.price = 29.9;
  }
  return base;
}

export function newStep(index = 0): MessageStep {
  return {
    id: newId(),
    title: index === 0 ? "Welcome message" : `Message ${index + 1}`,
    type: "TEXT",
    text: index === 0 ? "Olá! Bem-vindo." : "",
    mediaUrls: [],
    delayMs: 0,
    buttons: index === 0 ? [newButton("LIVEPIX_PAYMENT")] : [],
  };
}
