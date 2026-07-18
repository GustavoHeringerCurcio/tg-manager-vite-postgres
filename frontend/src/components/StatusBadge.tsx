import type { BotStatus } from "../lib/api";

const classes: Record<BotStatus, string> = {
  ACTIVE: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  INACTIVE: "bg-slate-400/15 text-slate-300 ring-slate-400/30",
  SUSPENDED: "bg-amber-400/15 text-amber-300 ring-amber-400/30"
};

export default function StatusBadge({ status }: { status: BotStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${classes[status]}`}>{status}</span>;
}
