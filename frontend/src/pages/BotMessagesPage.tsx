import { useParams, useNavigate } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { useBots } from "@/hooks/useBots";
import BotForm from "@/components/forms/BotForm";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { BotPayload } from "@/types";
import { useState } from "react";
import { Workflow } from "lucide-react";

export default function BotMessagesPage() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { bot, loading, error, refresh } = useBotDetail(botId);
  const { updateBot } = useBots();
  const [saving, setSaving] = useState(false);

  async function handleSave(payload: BotPayload) {
    if (!botId) return;
    setSaving(true);
    try {
      await updateBot(botId, payload);
      toast.success("Bot updated successfully");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update bot");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-destructive">{error || "Bot not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <Workflow className="size-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Message Flow</h1>
          <p className="text-sm text-muted-foreground">Edit message sequence for {bot.name}</p>
        </div>
      </div>
      <BotForm
        bot={bot}
        saving={saving}
        onSave={handleSave}
        onCancel={() => navigate(`/manager/${botId}/dashboard`)}
        mode="messages"
      />
    </div>
  );
}
