import { useEffect, useState } from "react";
import BotForm from "../components/BotForm";
import BotTable from "../components/BotTable";
import InteractionsView from "../components/InteractionsView";
import TransactionsView from "../components/TransactionsView";
import { api } from "../lib/api";
import type { Bot, BotPayload, BotStatus, Stats } from "../lib/api";

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selected, setSelected] = useState<Bot | null>(null);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setError("");
    try {
      const list = await api.bots();
      setBots(list);
      setSelected((current) => list.find((bot) => bot.id === current?.id) ?? list[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bots");
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!selected) {
      setStats(null);
      return;
    }
    api.stats(selected.id).then(setStats).catch(() => setStats(null));
  }, [selected]);

  async function save(payload: BotPayload) {
    setLoading(true);
    try {
      if (editing) await api.updateBot(editing.id, payload);
      else await api.createBot(payload);
      setEditing(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(bot: Bot, status: BotStatus) {
    setLoading(true);
    try {
      await api.setStatus(bot.id, status);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteBot(bot: Bot) {
    if (!confirm(`Delete ${bot.name}?`)) return;
    setLoading(true);
    try {
      await api.deleteBot(bot.id);
      if (selected?.id === bot.id) setSelected(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070814] px-4 py-6 text-slate-100 md:px-8">
      <header className="mx-auto flex max-w-7xl flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Botflix v2</p><h1 className="mt-2 text-3xl font-semibold text-white">Bot operations dashboard</h1></div>
        <div className="flex gap-3"><button className="rounded-xl bg-white/10 px-4 py-2" onClick={() => void refresh()}>Refresh</button><button className="rounded-xl bg-red-500/20 px-4 py-2 text-red-100" onClick={onLogout}>Logout</button></div>
      </header>
      <div className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[minmax(460px,560px)_1fr]">
        <aside className="space-y-6"><BotForm editing={editing} loading={loading} onSubmit={save} onCancel={() => setEditing(null)} />{error && <p className="rounded-xl bg-red-500/20 p-3 text-red-100">{error}</p>}</aside>
        <section className="space-y-6 overflow-hidden">
          <BotTable bots={bots} selectedId={selected?.id ?? null} onSelect={setSelected} onEdit={setEditing} onStatus={changeStatus} onDelete={(bot) => void deleteBot(bot)} />
          <div className="grid gap-3 md:grid-cols-5">{[
            ["Users", stats?.totalUsers ?? 0], ["Interactions", stats?.totalInteractions ?? 0], ["Messages", stats?.messageCount ?? 0], ["Callbacks", stats?.callbackCount ?? 0], ["Payments", stats?.checkoutClicks ?? 0]
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold text-white">{value}</p></div>)}</div>
          <TransactionsView bot={selected} />
          <InteractionsView bot={selected} />
        </section>
      </div>
    </main>
  );
}
