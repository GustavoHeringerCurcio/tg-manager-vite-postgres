import { Link } from "react-router-dom";
import { useBots } from "@/hooks/useBots";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import BotCard from "@/components/bots/BotCard";
import BotCardGrid from "@/components/bots/BotCardGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, Plus, Search, X } from "lucide-react";
import { useState, useMemo } from "react";
import type { BotStatus } from "@/types";

const STATUS_FILTERS: { value: BotStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
];

export default function ManagerPage() {
  const { bots, stats, loading, error, setStatus, deleteBot, refresh } = useBots();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BotStatus | "ALL">("ALL");

  const filteredBots = useMemo(() => {
    return bots.filter((bot) => {
      const matchesSearch = bot.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || bot.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bots, search, statusFilter]);

  const activeCount = bots.filter((b) => b.status === "ACTIVE").length;
  const inactiveCount = bots.filter((b) => b.status === "INACTIVE").length;
  const suspendedCount = bots.filter((b) => b.status === "SUSPENDED").length;

  async function handleStatusChange(id: string, newStatus: "ACTIVE" | "INACTIVE") {
    try {
      await setStatus(id, newStatus);
      toast.success(`Bot ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBot(id);
      toast.success("Bot deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bot");
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bots</h1>
          <p className="text-sm text-muted-foreground">Manage your Telegram bots</p>
        </div>
      </div>

      {!loading && !error && bots.length > 0 && (
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{bots.length}</span> bot{bots.length !== 1 ? "s" : ""}
            {activeCount > 0 && (
              <> · <span className="text-emerald-500 font-medium">{activeCount}</span> active</>
            )}
            {inactiveCount > 0 && (
              <> · <span className="text-muted-foreground font-medium">{inactiveCount}</span> inactive</>
            )}
            {suspendedCount > 0 && (
              <> · <span className="text-destructive font-medium">{suspendedCount}</span> suspended</>
            )}
          </p>
        </div>
      )}

      {!loading && !error && bots.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search bots..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-xs"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(({ value, label }) => {
              const count = value === "ALL" ? bots.length : bots.filter((b) => b.status === value).length;
              return (
                <Button
                  key={value}
                  variant={statusFilter === value ? "default" : "outline"}
                  size="xs"
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                  <span className="ml-1 text-[10px] opacity-60 tabular-nums">{count}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-20 animate-fade-in">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <Bot className="size-8 text-destructive/40" />
          </div>
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={refresh}>Retry</Button>
        </div>
      ) : bots.length === 0 ? (
        <div className="flex flex-col items-center gap-6 py-20 animate-fade-in">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
            <Bot className="size-10 text-muted-foreground/30" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-lg font-semibold">No bots yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first Telegram bot to start managing automated conversations and payments.
            </p>
          </div>
          <Button variant="default" size="lg" render={<Link to="/manager/new" />} className="shadow-glow-primary">
            <Plus className="mr-2 size-4" />
            Create Your First Bot
          </Button>
        </div>
      ) : filteredBots.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 animate-fade-in">
          <p className="text-sm text-muted-foreground">No bots match your filters</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <BotCardGrid>
          {filteredBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              stats={stats[bot.id]}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </BotCardGrid>
      )}
    </div>
  );
}
