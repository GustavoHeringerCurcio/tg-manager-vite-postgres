import { useEffect, useState } from "react";
import type { Bot, Interaction, Paginated } from "../lib/api";
import { api } from "../lib/api";

export default function InteractionsView({ bot }: { bot: Bot | null }) {
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [data, setData] = useState<Paginated<Interaction> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bot) return;
    const filters = new URLSearchParams();
    if (type) filters.set("type", type);
    if (userId) filters.set("userId", userId);
    if (from) filters.set("from", from);
    if (to) filters.set("to", to);
    setLoading(true);
    api.interactions(bot.id, page, filters).then(setData).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [bot, page, type, userId, from, to]);

  if (!bot) return <section className="rounded-3xl border border-white/10 p-5 text-slate-300">Select a bot to view interactions.</section>;
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-lg font-semibold text-white">Interactions</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><select className="rounded-xl px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="message">message</option><option value="callback_query">callback_query</option></select><input className="rounded-xl px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" /><input className="rounded-xl px-3 py-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><input className="rounded-xl px-3 py-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {loading && <p className="mt-3 text-slate-300">Loading...</p>}
      {error && <p className="mt-3 text-red-300">{error}</p>}
      {data && data.items.length === 0 && <p className="mt-3 text-slate-300">No interactions found.</p>}
      {data && data.items.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-slate-300"><tr><th className="p-2">Date</th><th className="p-2">User</th><th className="p-2">Type</th><th className="p-2">Direction</th><th className="p-2">Content</th></tr></thead><tbody>{data.items.map((item) => <tr className="border-t border-white/10 align-top" key={item.id} onClick={() => setExpanded(expanded === item.id ? null : item.id)}><td className="p-2">{new Date(item.createdAt).toLocaleString()}</td><td className="p-2">{item.user?.username ?? item.user?.telegramId ?? "-"}</td><td className="p-2">{item.type}</td><td className="p-2">{item.direction}</td><td className="p-2"><p>{item.content ?? "-"}</p>{expanded === item.id && item.payload && <pre className="mt-2 max-h-52 overflow-auto rounded-lg bg-black/40 p-2 text-xs">{JSON.stringify(item.payload, null, 2)}</pre>}</td></tr>)}</tbody></table></div>}
      <div className="mt-4 flex gap-2"><button className="rounded-lg bg-white/10 px-3 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="rounded-lg bg-white/10 px-3 py-2" onClick={() => setPage((p) => p + 1)}>Next</button></div>
    </section>
  );
}
