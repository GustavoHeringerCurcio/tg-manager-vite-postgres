import { useEffect, useState } from "react";
import type { Bot, BotPayload, ButtonStyle } from "../lib/api";

const blank: BotPayload = {
  name: "",
  token: "",
  welcomeVideoUrl: "",
  welcomeText: "",
  checkoutButtonText: "Pagar agora",
  checkoutButtonStyle: "primary",
  supportButtonText: "Suporte",
  supportButtonStyle: "primary",
  supportUrl: "",
  checkoutAmount: 29.9
};

type Props = {
  editing: Bot | null;
  loading: boolean;
  onSubmit: (payload: BotPayload) => Promise<void>;
  onCancel: () => void;
};

export default function BotForm({ editing, loading, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<BotPayload>(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) {
      setForm(blank);
      return;
    }
    setForm({
      name: editing.name,
      token: "",
      welcomeVideoUrl: editing.welcomeVideoUrl ?? "",
      welcomeText: editing.welcomeText ?? "",
      checkoutButtonText: editing.checkoutButtonText,
      checkoutButtonStyle: editing.checkoutButtonStyle,
      supportButtonText: editing.supportButtonText,
      supportButtonStyle: editing.supportButtonStyle,
      supportUrl: editing.supportUrl ?? "",
      checkoutAmount: editing.checkoutAmount
    });
  }, [editing]);

  function patch(field: keyof BotPayload, value: string | number) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError("Bot name is required");
      return;
    }
    if (!editing && !form.token?.trim()) {
      setError("Bot token is required on create");
      return;
    }
    setError("");
    await onSubmit({ ...form, token: form.token?.trim() || undefined });
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[0.07] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">{editing ? "Edit bot" : "Create bot"}</h2>
        {editing && <button type="button" onClick={onCancel} className="text-sm text-cyan-300">Cancel edit</button>}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <input className="rounded-xl px-3 py-2" value={form.name} onChange={(e) => patch("name", e.target.value)} placeholder="Bot name" />
        <input className="rounded-xl px-3 py-2" value={form.token ?? ""} onChange={(e) => patch("token", e.target.value)} placeholder={editing ? "New token optional" : "Bot token"} type="password" />
        <input className="rounded-xl px-3 py-2" value={form.welcomeVideoUrl ?? ""} onChange={(e) => patch("welcomeVideoUrl", e.target.value)} placeholder="Welcome video URL/file_id" />
        <input className="rounded-xl px-3 py-2" value={form.checkoutAmount} onChange={(e) => patch("checkoutAmount", Number(e.target.value))} placeholder="Amount BRL" type="number" step="0.01" min="0.01" />
        <input className="rounded-xl px-3 py-2" value={form.checkoutButtonText} onChange={(e) => patch("checkoutButtonText", e.target.value)} placeholder="Checkout button text" />
        <select className="rounded-xl px-3 py-2" value={form.checkoutButtonStyle} onChange={(e) => patch("checkoutButtonStyle", e.target.value as ButtonStyle)}><option value="primary">primary</option><option value="success">success</option><option value="danger">danger</option></select>
        <input className="rounded-xl px-3 py-2" value={form.supportButtonText} onChange={(e) => patch("supportButtonText", e.target.value)} placeholder="Support button text" />
        <select className="rounded-xl px-3 py-2" value={form.supportButtonStyle} onChange={(e) => patch("supportButtonStyle", e.target.value as ButtonStyle)}><option value="primary">primary</option><option value="success">success</option><option value="danger">danger</option></select>
        <input className="rounded-xl px-3 py-2 md:col-span-2" value={form.supportUrl ?? ""} onChange={(e) => patch("supportUrl", e.target.value)} placeholder="Support URL" />
        <textarea className="min-h-28 rounded-xl px-3 py-2 md:col-span-2" value={form.welcomeText ?? ""} onChange={(e) => patch("welcomeText", e.target.value)} placeholder="Welcome text" />
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <button className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60" disabled={loading}>{loading ? "Saving..." : editing ? "Save changes" : "Create and activate"}</button>
    </form>
  );
}
