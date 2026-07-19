import { useNavigate } from "react-router-dom";
import { useBots } from "@/hooks/useBots";
import BotForm from "@/components/forms/BotForm";
import { toast } from "sonner";
import type { BotPayload } from "@/types";
import { useState } from "react";
import { Sparkles } from "lucide-react";

export default function CreateBotPage() {
  const navigate = useNavigate();
  const { createBot } = useBots();
  const [saving, setSaving] = useState(false);

  async function handleSave(payload: BotPayload) {
    setSaving(true);
    try {
      const bot = await createBot(payload);
      toast.success(`Bot "${bot.name}" created`);
      navigate(`/manager/${bot.id}/dashboard`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <Sparkles className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Create New Bot</h1>
          <p className="text-sm text-muted-foreground">Set up a new Telegram bot from scratch</p>
        </div>
      </div>
      <BotForm
        saving={saving}
        onSave={handleSave}
        onCancel={() => navigate("/manager")}
        requireToken
      />
    </div>
  );
}
