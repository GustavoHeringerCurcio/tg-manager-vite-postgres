import { useEffect, useState } from "react";
import type { Bot, BotPayload, ButtonAction, ButtonColor, MessageButton, MessageStep, MessageType } from "../lib/api";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function newButton(action: ButtonAction = "OPEN_URL"): MessageButton {
  return { id: newId(), label: action === "LIVEPIX_PAYMENT" ? "Pagar agora" : "Abrir link", color: action === "LIVEPIX_PAYMENT" ? "GREEN" : "BLUE", action, url: "" };
}

function newStep(index = 0): MessageStep {
  return { id: newId(), title: index === 0 ? "Welcome message" : `Message ${index + 1}`, type: "TEXT", text: index === 0 ? "Olá! Bem-vindo." : "", mediaUrl: "", delayMs: 0, buttons: index === 0 ? [newButton("LIVEPIX_PAYMENT")] : [] };
}

function blank(): BotPayload {
  return { name: "", token: "", checkoutAmount: 29.9, messageFlow: [newStep(0)] };
}

const colorClasses: Record<ButtonColor, string> = {
  BLUE: "border-sky-300/40 bg-sky-500/20 text-sky-100",
  GREEN: "border-emerald-300/40 bg-emerald-500/20 text-emerald-100",
  RED: "border-red-300/40 bg-red-500/20 text-red-100"
};

type Props = {
  editing: Bot | null;
  loading: boolean;
  onSubmit: (payload: BotPayload) => Promise<void>;
  onCancel: () => void;
};

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      {helper && <span className="mt-1 block text-xs text-slate-400">{helper}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function inputClass(extra = ""): string {
  return `w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white outline-none ring-cyan-300/0 transition focus:border-cyan-300/60 focus:ring-4 ${extra}`;
}

export default function BotForm({ editing, loading, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<BotPayload>(() => blank());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) {
      setForm(blank());
      return;
    }
    setForm({
      name: editing.name,
      token: "",
      checkoutAmount: editing.checkoutAmount,
      messageFlow: editing.messageFlow.length > 0 ? editing.messageFlow : [newStep(0)]
    });
  }, [editing]);

  function patch(field: keyof BotPayload, value: string | number | MessageStep[]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function patchStep(index: number, value: Partial<MessageStep>) {
    patch("messageFlow", form.messageFlow.map((step, currentIndex) => currentIndex === index ? { ...step, ...value } : step));
  }

  function patchButton(stepIndex: number, buttonIndex: number, value: Partial<MessageButton>) {
    patch("messageFlow", form.messageFlow.map((step, currentStepIndex) => {
      if (currentStepIndex !== stepIndex) return step;
      return { ...step, buttons: step.buttons.map((button, currentButtonIndex) => currentButtonIndex === buttonIndex ? { ...button, ...value } : button) };
    }));
  }

  function addStep() {
    patch("messageFlow", [...form.messageFlow, newStep(form.messageFlow.length)]);
  }

  function removeStep(index: number) {
    patch("messageFlow", form.messageFlow.filter((_step, currentIndex) => currentIndex !== index));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= form.messageFlow.length) return;
    const next = [...form.messageFlow];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    patch("messageFlow", next);
  }

  function addButton(stepIndex: number) {
    const step = form.messageFlow[stepIndex];
    if (!step || step.buttons.length >= 3) return;
    patchStep(stepIndex, { buttons: [...step.buttons, newButton()] });
  }

  function removeButton(stepIndex: number, buttonIndex: number) {
    const step = form.messageFlow[stepIndex];
    if (!step) return;
    patchStep(stepIndex, { buttons: step.buttons.filter((_button, currentIndex) => currentIndex !== buttonIndex) });
  }

  function validate(): string | undefined {
    if (!form.name.trim()) return "Bot name is required";
    if (!editing && !form.token?.trim()) return "Bot token is required on create";
    if (!Number.isFinite(form.checkoutAmount) || form.checkoutAmount <= 0) return "Default LivePix amount must be positive";
    for (const [stepIndex, step] of form.messageFlow.entries()) {
      if (step.type === "TEXT" && !step.text?.trim()) return `Message ${stepIndex + 1} needs text`;
      if ((step.type === "AUDIO" || step.type === "VIDEO") && !step.mediaUrl?.trim()) return `Message ${stepIndex + 1} needs a media URL or Telegram file_id`;
      if (step.buttons.length > 3) return `Message ${stepIndex + 1} can have at most 3 buttons`;
      for (const [buttonIndex, button] of step.buttons.entries()) {
        if (!button.label.trim()) return `Message ${stepIndex + 1}, button ${buttonIndex + 1} needs a label`;
        if (button.action === "OPEN_URL" && !button.url?.trim()) return `Message ${stepIndex + 1}, button ${buttonIndex + 1} needs a URL`;
      }
    }
    return undefined;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    await onSubmit({ ...form, token: form.token?.trim() || undefined });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-3xl border border-white/10 bg-white/[0.07] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Bot settings</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{editing ? "Edit bot" : "Create bot"}</h2>
          </div>
          {editing && <button type="button" onClick={onCancel} className="text-sm text-cyan-300">Cancel edit</button>}
        </div>
        <div className="mt-5 grid gap-4">
          <Field label="Bot name" helper="Internal name shown only in this dashboard.">
            <input className={inputClass()} value={form.name} onChange={(e) => patch("name", e.target.value)} />
          </Field>
          <Field label="Telegram bot token" helper={editing ? "Leave empty to keep the current token." : "Token from BotFather. Required when creating a bot."}>
            <input className={inputClass()} value={form.token ?? ""} onChange={(e) => patch("token", e.target.value)} type="password" />
          </Field>
          <Field label="Default LivePix amount" helper="Used by every button with the LivePix payment action.">
            <input className={inputClass()} value={form.checkoutAmount} onChange={(e) => patch("checkoutAmount", Number(e.target.value))} type="number" step="0.01" min="0.01" />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.07] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Message flow</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Start sequence</h2>
            <p className="mt-1 text-sm text-slate-400">Send unlimited messages in order. Each message can have up to 3 buttons, one per row.</p>
          </div>
          <button type="button" onClick={addStep} className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950">Add message</button>
        </div>

        <div className="mt-5 space-y-4">
          {form.messageFlow.map((step, stepIndex) => (
            <article key={step.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Message {stepIndex + 1}</p>
                  <p className="text-xs text-slate-400">Delay is applied before the next message.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => moveStep(stepIndex, -1)} disabled={stepIndex === 0} className="rounded-lg bg-white/10 px-3 py-1 text-sm text-slate-200 disabled:opacity-40">Up</button>
                  <button type="button" onClick={() => moveStep(stepIndex, 1)} disabled={stepIndex === form.messageFlow.length - 1} className="rounded-lg bg-white/10 px-3 py-1 text-sm text-slate-200 disabled:opacity-40">Down</button>
                  <button type="button" onClick={() => removeStep(stepIndex)} className="rounded-lg bg-red-500/20 px-3 py-1 text-sm text-red-200">Remove</button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Admin title" helper="Only used to organize this flow.">
                  <input className={inputClass()} value={step.title} onChange={(e) => patchStep(stepIndex, { title: e.target.value })} />
                </Field>
                <Field label="Message type">
                  <select className={inputClass()} value={step.type} onChange={(e) => patchStep(stepIndex, { type: e.target.value as MessageType })}>
                    <option value="TEXT">Text</option>
                    <option value="AUDIO">Audio</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </Field>
                {(step.type === "AUDIO" || step.type === "VIDEO") && (
                  <Field label={`${step.type === "AUDIO" ? "Audio" : "Video"} URL or Telegram file_id`} helper="Use an https URL or a Telegram file_id already known by the bot.">
                    <input className={inputClass()} value={step.mediaUrl ?? ""} onChange={(e) => patchStep(stepIndex, { mediaUrl: e.target.value })} />
                  </Field>
                )}
                <Field label="Delay before next message" helper="Seconds. Leave 0 to send the next message immediately.">
                  <input className={inputClass()} value={(step.delayMs ?? 0) / 1000} onChange={(e) => patchStep(stepIndex, { delayMs: Math.max(0, Math.round(Number(e.target.value) * 1000)) })} type="number" min="0" step="0.5" />
                </Field>
                <Field label={step.type === "TEXT" ? "Message text" : "Caption text"} helper={step.type === "TEXT" ? "Required for text messages." : "Optional caption shown with the media."}>
                  <textarea className={inputClass("min-h-28 md:col-span-2")} value={step.text ?? ""} onChange={(e) => patchStep(stepIndex, { text: e.target.value })} />
                </Field>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Buttons</p>
                    <p className="text-xs text-slate-400">Maximum 3 buttons. Telegram shows them one per row.</p>
                  </div>
                  <button type="button" onClick={() => addButton(stepIndex)} disabled={step.buttons.length >= 3} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-cyan-200 disabled:opacity-40">Add button</button>
                </div>
                <div className="mt-3 space-y-3">
                  {step.buttons.map((button, buttonIndex) => (
                    <div key={button.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Button label">
                          <input className={inputClass()} value={button.label} onChange={(e) => patchButton(stepIndex, buttonIndex, { label: e.target.value })} />
                        </Field>
                        <Field label="Button action">
                          <select className={inputClass()} value={button.action} onChange={(e) => patchButton(stepIndex, buttonIndex, { action: e.target.value as ButtonAction, url: e.target.value === "OPEN_URL" ? button.url ?? "" : undefined })}>
                            <option value="OPEN_URL">Open URL</option>
                            <option value="LIVEPIX_PAYMENT">LivePix payment</option>
                          </select>
                        </Field>
                        <Field label="Button color" helper="Used in this dashboard preview. Telegram renders buttons with its native style.">
                          <select className={inputClass()} value={button.color} onChange={(e) => patchButton(stepIndex, buttonIndex, { color: e.target.value as ButtonColor })}>
                            <option value="BLUE">Blue</option>
                            <option value="GREEN">Green</option>
                            <option value="RED">Red</option>
                          </select>
                        </Field>
                        {button.action === "OPEN_URL" && (
                          <Field label="Destination URL">
                            <input className={inputClass()} value={button.url ?? ""} onChange={(e) => patchButton(stepIndex, buttonIndex, { url: e.target.value })} />
                          </Field>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className={`rounded-lg border px-3 py-1 text-sm ${colorClasses[button.color]}`}>{button.label || "Button preview"}</span>
                        <button type="button" onClick={() => removeButton(stepIndex, buttonIndex)} className="text-sm text-red-200">Remove button</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-500/20 p-3 text-sm text-red-100">{error}</p>}
      <button className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60" disabled={loading}>{loading ? "Saving..." : editing ? "Save changes" : "Create and activate"}</button>
    </form>
  );
}
