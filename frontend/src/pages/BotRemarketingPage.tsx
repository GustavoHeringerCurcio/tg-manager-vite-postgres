import { useParams, useNavigate } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { useBots } from "@/hooks/useBots";
import BotForm from "@/components/forms/BotForm";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { BotPayload } from "@/types";
import { useState } from "react";

export default function BotRemarketingPage() {
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
      toast.success("Remarketing updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Remarketing</h1>
        <p className="text-muted-foreground">Follow-up sequence for {bot.name}</p>
      </div>
      <BotForm
        bot={bot}
        saving={saving}
        onSave={handleSave}
        onCancel={() => navigate(`/manager/${botId}/dashboard`)}
      />
    </div>
  );
}
