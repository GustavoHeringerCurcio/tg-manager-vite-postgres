import { useEffect, useState } from "react";
import type { Bot, Paginated, Transaction } from "../lib/api";
import { api } from "../lib/api";

export default function TransactionsView({ bot }: { bot: Bot | null }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Transaction> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bot) return;
    setLoading(true);
    api.transactions(bot.id, page).then(setData).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [bot, page]);

  if (!bot) return <section className="rounded-3xl border border-white/10 p-5 text-slate-300">Select a bot to view transactions.</section>;
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-lg font-semibold text-white">Transactions</h2>
      {loading && <p className="mt-3 text-slate-300">Loading...</p>}
      {error && <p className="mt-3 text-red-300">{error}</p>}
      {data && data.items.length === 0 && <p className="mt-3 text-slate-300">No transactions found.</p>}
      {data && data.items.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-slate-300"><tr><th className="p-2">Date</th><th className="p-2">User</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">PIX</th><th className="p-2">Checkout</th></tr></thead><tbody>{data.items.map((item) => <tr className="border-t border-white/10" key={item.id}><td className="p-2">{new Date(item.createdAt).toLocaleString()}</td><td className="p-2">{item.user.username ?? item.user.telegramId}</td><td className="p-2">R$ {item.amount.toFixed(2)}</td><td className="p-2">{item.status}</td><td className="p-2">{item.pixCode ? "Available" : "No"}</td><td className="p-2">{item.checkoutUrl ? <a className="text-cyan-300" href={item.checkoutUrl} target="_blank">Open</a> : "No"}</td></tr>)}</tbody></table></div>}
      <div className="mt-4 flex gap-2"><button className="rounded-lg bg-white/10 px-3 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button><button className="rounded-lg bg-white/10 px-3 py-2" onClick={() => setPage((p) => p + 1)}>Next</button></div>
    </section>
  );
}
