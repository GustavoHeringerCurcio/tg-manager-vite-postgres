export type { ButtonAction, ButtonColor, MessageButton, MessageStep, MessageType } from "../lib/api";

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function newButton(action: import("../lib/api").ButtonAction = "OPEN_URL"): import("../lib/api").MessageButton {
  return { id: newId(), label: action === "LIVEPIX_PAYMENT" ? "Pagar agora" : "Abrir link", color: action === "LIVEPIX_PAYMENT" ? "GREEN" : "BLUE", action, url: "" };
}

export function newStep(index = 0): import("../lib/api").MessageStep {
  return { id: newId(), title: index === 0 ? "Welcome message" : `Message ${index + 1}`, type: "TEXT", text: index === 0 ? "Olá! Bem-vindo." : "", mediaUrls: [], delayMs: 0, buttons: index === 0 ? [newButton("LIVEPIX_PAYMENT")] : [] };
}

export const colorClasses: Record<import("../lib/api").ButtonColor, string> = {
  BLUE: "border-sky-300/40 bg-sky-500/20 text-sky-100",
  GREEN: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100",
  RED: "border-red-300/40 bg-red-500/20 text-red-100"
};

export function inputClass(extra = ""): string {
  return `w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none ring-cyan-300/0 transition focus:border-cyan-300/60 focus:ring-4 ${extra}`;
}

export const typeBadge: Record<import("../lib/api").MessageType, { label: string; colors: string }> = {
  TEXT: { label: "Text", colors: "bg-sky-500/20 text-sky-200 border-sky-300/30" },
  AUDIO: { label: "Audio", colors: "bg-purple-500/20 text-purple-200 border-purple-300/30" },
  VIDEO: { label: "Video", colors: "bg-rose-500/20 text-rose-200 border-rose-300/30" }
};

export function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      {helper && <span className="mt-1 block text-xs text-slate-400">{helper}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
