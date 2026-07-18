import { randomUUID } from "node:crypto";

export const MESSAGE_TYPES = ["TEXT", "AUDIO", "VIDEO"] as const;
export const BUTTON_COLORS = ["BLUE", "GREEN", "RED"] as const;
export const BUTTON_ACTIONS = ["OPEN_URL", "LIVEPIX_PAYMENT"] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];
export type ButtonColor = (typeof BUTTON_COLORS)[number];
export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

export type MessageButton = {
  id: string;
  label: string;
  color: ButtonColor;
  action: ButtonAction;
  url?: string;
};

export type MessageStep = {
  id: string;
  title: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  delayMs: number;
  buttons: MessageButton[];
};

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

function idFrom(value: unknown): string {
  const clean = cleanString(value);
  return clean && clean.length <= 48 ? clean : randomUUID();
}

function normalizeButton(value: unknown, messageIndex: number, buttonIndex: number): MessageButton {
  if (!isRecord(value)) throw new Error(`message ${messageIndex + 1}, button ${buttonIndex + 1} must be an object`);
  const label = cleanString(value.label);
  if (!label) throw new Error(`message ${messageIndex + 1}, button ${buttonIndex + 1} label is required`);
  if (label.length > 80) throw new Error(`message ${messageIndex + 1}, button ${buttonIndex + 1} label must be 80 characters or less`);
  const color = cleanString(value.color) ?? "BLUE";
  if (!BUTTON_COLORS.includes(color as ButtonColor)) throw new Error(`message ${messageIndex + 1}, button ${buttonIndex + 1} color must be BLUE, GREEN, or RED`);
  const action = cleanString(value.action);
  if (!BUTTON_ACTIONS.includes(action as ButtonAction)) throw new Error(`message ${messageIndex + 1}, button ${buttonIndex + 1} action is invalid`);
  const button: MessageButton = {
    id: idFrom(value.id),
    label,
    color: color as ButtonColor,
    action: action as ButtonAction
  };
  if (button.action === "OPEN_URL") button.url = validateUrl(cleanString(value.url), `message ${messageIndex + 1}, button ${buttonIndex + 1} URL`);
  return button;
}

export function normalizeMessageFlow(value: unknown): MessageStep[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error("messageFlow must be an array");
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`message ${index + 1} must be an object`);
    const type = cleanString(item.type) ?? "TEXT";
    if (!MESSAGE_TYPES.includes(type as MessageType)) throw new Error(`message ${index + 1} type must be TEXT, AUDIO, or VIDEO`);
    const text = cleanString(item.text);
    const mediaUrl = cleanString(item.mediaUrl);
    if (type === "TEXT" && !text) throw new Error(`message ${index + 1} text is required`);
    if ((type === "AUDIO" || type === "VIDEO") && !mediaUrl) throw new Error(`message ${index + 1} media URL/file_id is required`);
    const delayMs = Number(item.delayMs ?? 0);
    if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error(`message ${index + 1} delay must be zero or greater`);
    const rawButtons = item.buttons ?? [];
    if (!Array.isArray(rawButtons)) throw new Error(`message ${index + 1} buttons must be an array`);
    if (rawButtons.length > 3) throw new Error(`message ${index + 1} can have at most 3 buttons`);
    return {
      id: idFrom(item.id),
      title: cleanString(item.title) ?? `Message ${index + 1}`,
      type: type as MessageType,
      text,
      mediaUrl,
      delayMs: Math.round(delayMs),
      buttons: rawButtons.map((button, buttonIndex) => normalizeButton(button, index, buttonIndex))
    };
  });
}

export function defaultMessageFlow(): MessageStep[] {
  return [{
    id: randomUUID(),
    title: "Welcome message",
    type: "TEXT",
    text: "Olá! Bem-vindo.",
    delayMs: 0,
    buttons: [{ id: randomUUID(), label: "Pagar agora", color: "GREEN", action: "LIVEPIX_PAYMENT" }]
  }];
}
