import { useState } from "react";
import type { ButtonAction, ButtonColor, MessageButton, MessageStep, MessageType, RemarketingConfig } from "../lib/api";
import { newId, newButton, colorClasses, inputClass, typeBadge, Field } from "./shared";

const TIME_UNITS = [
  { value: 1, label: "seconds" },
  { value: 60, label: "minutes" },
  { value: 3600, label: "hours" },
  { value: 86400, label: "days" }
] as const;

function bestUnit(ms: number): { value: number; unit: (typeof TIME_UNITS)[number] } {
  if (ms === 0) return { value: 0, unit: TIME_UNITS[0] };
  const seconds = ms / 1000;
  for (let i = TIME_UNITS.length - 1; i >= 0; i--) {
    const unit = TIME_UNITS[i];
    if (seconds % unit.value === 0) {
      return { value: seconds / unit.value, unit };
    }
  }
  return { value: seconds, unit: TIME_UNITS[0] };
}

function msFromUnit(value: number, unitValue: number): number {
  return Math.max(0, Math.round(value * unitValue * 1000));
}

function newRemarketingMessage(index: number): MessageStep {
  return {
    id: newId(),
    title: `Remarketing ${index + 1}`,
    type: "VIDEO",
    text: "",
    mediaUrls: [""],
    delayMs: 0,
    buttons: []
  };
}

type Props = {
  config: RemarketingConfig;
  onChange: (config: RemarketingConfig) => void;
};

export default function RemarketingEditor({ config, onChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const interval = bestUnit(config.intervalMs);
  const initialDelay = bestUnit(config.initialDelayMs);

  function patch(partial: Partial<RemarketingConfig>) {
    onChange({ ...config, ...partial });
  }

  function patchMessage(index: number, partial: Partial<MessageStep>) {
    const messages = config.messages.map((msg, i) => i === index ? { ...msg, ...partial } : msg);
    patch({ messages });
  }

  function patchButton(msgIndex: number, btnIndex: number, partial: Partial<MessageButton>) {
    const messages = config.messages.map((msg, mi) => {
      if (mi !== msgIndex) return msg;
      return { ...msg, buttons: msg.buttons.map((btn, bi) => bi === btnIndex ? { ...btn, ...partial } : btn) };
    });
    patch({ messages });
  }

  function addMessage() {
    patch({ messages: [...config.messages, newRemarketingMessage(config.messages.length)] });
  }

  function removeMessage(index: number) {
    if (!confirm("Remove this remarketing message?")) return;
    patch({ messages: config.messages.filter((_, i) => i !== index) });
  }

  function moveMessage(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= config.messages.length) return;
    const msgs = [...config.messages];
    const [item] = msgs.splice(index, 1);
    msgs.splice(next, 0, item);
    patch({ messages: msgs });
  }

  function duplicateMessage(index: number) {
    const msg = config.messages[index];
    if (!msg) return;
    const clone: MessageStep = { ...msg, id: newId(), title: `${msg.title} (copy)`, buttons: msg.buttons.map((b) => ({ ...b, id: newId() })) };
    const msgs = [...config.messages];
    msgs.splice(index + 1, 0, clone);
    patch({ messages: msgs });
  }

  function toggleCollapse(index: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function addMediaUrl(msgIndex: number) {
    const msg = config.messages[msgIndex];
    if (!msg) return;
    patchMessage(msgIndex, { mediaUrls: [...msg.mediaUrls, ""] });
  }

  function removeMediaUrl(msgIndex: number, urlIndex: number) {
    const msg = config.messages[msgIndex];
    if (!msg || msg.mediaUrls.length <= 1) return;
    patchMessage(msgIndex, { mediaUrls: msg.mediaUrls.filter((_, i) => i !== urlIndex) });
  }

  function patchMediaUrl(msgIndex: number, urlIndex: number, value: string) {
    const msg = config.messages[msgIndex];
    if (!msg) return;
    const next = [...msg.mediaUrls];
    next[urlIndex] = value;
    patchMessage(msgIndex, { mediaUrls: next });
  }

  function addButton(msgIndex: number) {
    const msg = config.messages[msgIndex];
    if (!msg || msg.buttons.length >= 3) return;
    patchMessage(msgIndex, { buttons: [...msg.buttons, newButton()] });
  }

  function removeButton(msgIndex: number, btnIndex: number) {
    if (!confirm("Remove this button?")) return;
    const msg = config.messages[msgIndex];
    if (!msg) return;
    patchMessage(msgIndex, { buttons: msg.buttons.filter((_, i) => i !== btnIndex) });
  }

  function handleBulkImport() {
    if (!bulkText.trim()) return;
    const lines = bulkText.trim().split("\n").filter((line) => line.trim());
    const newMessages = lines.map((line, i) => {
      const parts = line.split("|").map((p) => p.trim());
      const mediaUrl = parts[0] || "";
      const text = parts[1] || "";
      return {
        id: newId(),
        title: `Remarketing ${config.messages.length + i + 1}`,
        type: "VIDEO" as MessageType,
        text,
        mediaUrls: mediaUrl ? [mediaUrl] : [""],
        delayMs: 0,
        buttons: [] as MessageButton[]
      } satisfies MessageStep;
    });
    patch({ messages: [...config.messages, ...newMessages] });
    setBulkText("");
    setShowBulk(false);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.07] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Remarketing</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Follow-up sequence</h2>
          <p className="mt-1 text-sm text-slate-400">Send videos in a loop after /start. All messages share the same interval.</p>
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-slate-950/70 px-4 py-2 border border-white/10">
          <span className="text-sm text-slate-200">{config.enabled ? "Enabled" : "Disabled"}</span>
          <button
            type="button"
            onClick={() => patch({ enabled: !config.enabled })}
            className={`relative h-6 w-11 rounded-full transition ${config.enabled ? "bg-cyan-400" : "bg-white/20"}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition ${config.enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </label>
      </div>

      {config.enabled && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Interval between messages" helper="How long to wait between each remarketing message.">
              <div className="flex gap-2">
                <input
                  className={inputClass()}
                  type="number"
                  min="0"
                  step="1"
                  value={interval.value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0) {
                      patch({ intervalMs: msFromUnit(v, interval.unit.value) });
                    }
                  }}
                />
                <select
                  className={inputClass("w-32 shrink-0")}
                  value={interval.unit.value}
                  onChange={(e) => {
                    const unitVal = Number(e.target.value);
                    patch({ intervalMs: msFromUnit(interval.value, unitVal) });
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Initial delay" helper="Wait after /start before the first remarketing message.">
              <div className="flex gap-2">
                <input
                  className={inputClass()}
                  type="number"
                  min="0"
                  step="1"
                  value={initialDelay.value}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 0) {
                      patch({ initialDelayMs: msFromUnit(v, initialDelay.unit.value) });
                    }
                  }}
                />
                <select
                  className={inputClass("w-32 shrink-0")}
                  value={initialDelay.unit.value}
                  onChange={(e) => {
                    const unitVal = Number(e.target.value);
                    patch({ initialDelayMs: msFromUnit(initialDelay.value, unitVal) });
                  }}
                >
                  {TIME_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="Max total sends" helper="Stop after this many messages. 0 = unlimited loop.">
              <input
                className={inputClass()}
                type="number"
                min="0"
                step="1"
                value={config.maxSends}
                onChange={(e) => {
                  const v = Math.max(0, Math.round(Number(e.target.value)));
                  if (Number.isFinite(v)) patch({ maxSends: v });
                }}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" onClick={addMessage} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Add message</button>
              <button type="button" onClick={() => setShowBulk(!showBulk)} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-slate-200">
                {showBulk ? "Hide bulk import" : "Bulk import"}
              </button>
            </div>
            <span className="text-sm text-slate-400">{config.messages.length} message{config.messages.length !== 1 ? "s" : ""}</span>
          </div>

          {showBulk && (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="mb-2 text-sm text-slate-300">Paste one entry per line: <code className="text-cyan-300">URL | Caption text</code></p>
              <textarea
                className={inputClass("min-h-32")}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"https://example.com/video1.mp4 | Check this!\nhttps://example.com/video2.mp4 | Amazing offer"}
              />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={handleBulkImport} disabled={!bulkText.trim()} className="rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-40">Import</button>
                <button type="button" onClick={() => { setBulkText(""); setShowBulk(false); }} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-slate-200">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {config.messages.map((msg, msgIndex) => (
              <article key={msg.id} className="rounded-2xl border border-white/10 bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => toggleCollapse(msgIndex)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="shrink-0 text-xs text-slate-500">{collapsed.has(msgIndex) ? "\u25B6" : "\u25BC"}</span>
                    <span className="shrink-0 text-sm font-semibold text-white">#{msgIndex + 1}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${typeBadge[msg.type].colors}`}>{typeBadge[msg.type].label}</span>
                    <span className="truncate text-sm text-slate-400">{msg.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">{msg.buttons.length} btn</span>
                    {msg.mediaUrls.filter(Boolean).length > 0 && (
                      <span className="shrink-0 text-xs text-cyan-300/60">{msg.mediaUrls.filter(Boolean).length} media</span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => moveMessage(msgIndex, -1)} disabled={msgIndex === 0} className="rounded-lg bg-white/10 px-3 py-1 text-sm text-slate-200 disabled:opacity-40">Up</button>
                    <button type="button" onClick={() => moveMessage(msgIndex, 1)} disabled={msgIndex === config.messages.length - 1} className="rounded-lg bg-white/10 px-3 py-1 text-sm text-slate-200 disabled:opacity-40">Down</button>
                    <button type="button" onClick={() => duplicateMessage(msgIndex)} className="rounded-lg bg-white/10 px-3 py-1 text-sm text-slate-200">Dup</button>
                    <button type="button" onClick={() => removeMessage(msgIndex)} className="rounded-lg bg-red-500/20 px-3 py-1 text-sm text-red-200">Del</button>
                  </div>
                </button>

                {!collapsed.has(msgIndex) && (
                  <div className="border-t border-white/10 px-4 pb-4">
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <Field label="Admin title" helper="Only used to organize this list.">
                        <input className={inputClass()} value={msg.title} onChange={(e) => patchMessage(msgIndex, { title: e.target.value })} />
                      </Field>
                      <Field label="Message type">
                        <select className={inputClass()} value={msg.type} onChange={(e) => patchMessage(msgIndex, { type: e.target.value as MessageType })}>
                          <option value="TEXT">Text</option>
                          <option value="AUDIO">Audio</option>
                          <option value="VIDEO">Video</option>
                        </select>
                      </Field>
                      {(msg.type === "AUDIO" || msg.type === "VIDEO") && (
                        <div className="md:col-span-2">
                          <Field label={`${msg.type === "AUDIO" ? "Audio" : "Video"} URLs or Telegram file_ids`} helper="Use HTTPS URLs or Telegram file_ids. Multiple videos are sent as a media group.">
                            <div className="space-y-2">
                              {msg.mediaUrls.map((url, urlIndex) => (
                                <div key={urlIndex} className="flex items-center gap-2">
                                  <input
                                    className={inputClass()}
                                    value={url}
                                    onChange={(e) => patchMediaUrl(msgIndex, urlIndex, e.target.value)}
                                    placeholder="Telegram file_id or HTTPS URL"
                                  />
                                  {msg.mediaUrls.length > 1 && (
                                    <button type="button" onClick={() => removeMediaUrl(msgIndex, urlIndex)} className="shrink-0 rounded-lg bg-red-500/20 px-2 py-2 text-sm text-red-200">✕</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </Field>
                          {msg.type === "VIDEO" && (
                            <button type="button" onClick={() => addMediaUrl(msgIndex)} className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-cyan-200">+ Add file_id</button>
                          )}
                        </div>
                      )}
                      <Field label={msg.type === "TEXT" ? "Message text" : "Caption text"} helper={msg.type === "TEXT" ? "Required for text messages." : "Optional caption shown with the media."}>
                        <textarea className={inputClass("min-h-28")} value={msg.text ?? ""} onChange={(e) => patchMessage(msgIndex, { text: e.target.value })} />
                      </Field>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Buttons</p>
                          <p className="text-xs text-slate-400">Maximum 3 buttons per message.</p>
                        </div>
                        <button type="button" onClick={() => addButton(msgIndex)} disabled={msg.buttons.length >= 3} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-cyan-200 disabled:opacity-40">Add button</button>
                      </div>
                      <div className="mt-3 space-y-3">
                        {msg.buttons.map((btn, btnIndex) => (
                          <div key={btn.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              <Field label="Button label">
                                <input className={inputClass()} value={btn.label} onChange={(e) => patchButton(msgIndex, btnIndex, { label: e.target.value })} />
                              </Field>
                              <Field label="Button action">
                                <select className={inputClass()} value={btn.action} onChange={(e) => patchButton(msgIndex, btnIndex, { action: e.target.value as ButtonAction })}>
                                  <option value="OPEN_URL">Open URL</option>
                                  <option value="LIVEPIX_PAYMENT">LivePix payment</option>
                                </select>
                              </Field>
                              <Field label="Button color">
                                <select className={inputClass()} value={btn.color} onChange={(e) => patchButton(msgIndex, btnIndex, { color: e.target.value as ButtonColor })}>
                                  <option value="BLUE">Blue</option>
                                  <option value="GREEN">Green</option>
                                  <option value="RED">Red</option>
                                </select>
                              </Field>
                              {btn.action === "OPEN_URL" && (
                                <Field label="Destination URL">
                                  <input className={inputClass()} value={btn.url ?? ""} onChange={(e) => patchButton(msgIndex, btnIndex, { url: e.target.value })} />
                                </Field>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className={`rounded-lg border px-3 py-1 text-sm ${colorClasses[btn.color]}`}>{btn.label || "Button preview"}</span>
                              <button type="button" onClick={() => removeButton(msgIndex, btnIndex)} className="text-sm text-red-200">Remove button</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}

            {config.messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
                <p className="text-slate-400">No remarketing messages yet.</p>
                <button type="button" onClick={addMessage} className="mt-3 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Add first message</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
