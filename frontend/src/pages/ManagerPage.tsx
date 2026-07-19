import { Link } from "react-router-dom";
import { useBots } from "@/hooks/useBots";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import BotCard from "@/components/bots/BotCard";
import BotCardGrid from "@/components/bots/BotCardGrid";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Bot, Plus } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Bots</h1>
          <p className="text-muted-foreground">Manage your Telegram bots</p>
          <div className="mt-1 h-0.5 w-12 rounded-full bg-primary/40" />
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Bot className="size-12 text-muted-foreground/30" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={refresh}>Retry</Button>
        </div>
      ) : bots.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Bot className="size-16 text-muted-foreground/20" />
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">No bots yet</p>
            <p className="text-sm text-muted-foreground/70">Create your first Telegram bot to get started.</p>
          </div>
          <Button variant="default" render={<Link to="/manager/new" />}>
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
