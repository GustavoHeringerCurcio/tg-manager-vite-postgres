import type { Bot, BotStatus } from "../lib/api";
import StatusBadge from "./StatusBadge";

type Props = {
  bots: Bot[];
  selectedId: string | null;
  onSelect: (bot: Bot) => void;
  onEdit: (bot: Bot) => void;
  onStatus: (bot: Bot, status: BotStatus) => void;
  onDelete: (bot: Bot) => void;
};

export default function BotTable({ bots, selectedId, onSelect, onEdit, onStatus, onDelete }: Props) {
  if (bots.length === 0) return <div className="rounded-3xl border border-dashed border-white/20 p-8 text-center text-slate-300">No bots yet.</div>;
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-white/10 text-slate-300"><tr><th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Actions</th></tr></thead>
        <tbody>
          {bots.map((bot) => (
            <tr key={bot.id} className={`border-t border-white/10 ${selectedId === bot.id ? "bg-cyan-400/10" : "bg-white/[0.03]"}`}>
              <td className="p-3 font-medium text-white"><button onClick={() => onSelect(bot)}>{bot.name}</button></td>
              <td className="p-3"><StatusBadge status={bot.status} /></td>
              <td className="p-3 text-slate-300">{new Date(bot.createdAt).toLocaleString()}</td>
              <td className="flex flex-wrap gap-2 p-3">
                <button className="rounded-lg bg-white/10 px-3 py-1 text-cyan-200" onClick={() => onEdit(bot)}>Edit</button>
                <button className="rounded-lg bg-white/10 px-3 py-1 text-emerald-200" onClick={() => onStatus(bot, bot.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{bot.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                <button className="rounded-lg bg-red-500/20 px-3 py-1 text-red-200" onClick={() => onDelete(bot)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
