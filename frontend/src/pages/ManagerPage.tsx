import { Link } from "react-router-dom";
import { useBots } from "@/hooks/useBots";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import BotCard from "@/components/bots/BotCard";
import BotCardGrid from "@/components/bots/BotCardGrid";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Plus, RefreshCw } from "lucide-react";

export default function ManagerPage() {
  const { bots, loading, error, setStatus, deleteBot, refresh } = useBots();

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bots</h1>
          <p className="text-sm text-muted-foreground">Manage your Telegram bots</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
          <Button variant="default" size="sm" render={<Link to="/manager/new" />}>
            <Plus className="mr-1.5 size-3.5" />
            New Bot
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-20 animate-fade-in">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
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
      ) : (
        <BotCardGrid>
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </BotCardGrid>
      )}
    </div>
  );
}
