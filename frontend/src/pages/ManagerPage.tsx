import { useBots } from "@/hooks/useBots";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import BotCard from "@/components/bots/BotCard";
import BotCardGrid from "@/components/bots/BotCardGrid";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

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
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-2 size-4" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={refresh}>Retry</Button>
        </div>
      ) : bots.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-muted-foreground">No bots yet. Create your first bot!</p>
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
