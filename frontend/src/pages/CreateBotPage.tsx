import { useNavigate } from "react-router-dom";
import { useBots } from "@/hooks/useBots";
import BotForm from "@/components/forms/BotForm";
import { toast } from "sonner";
import type { BotPayload } from "@/types";
import { useState } from "react";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Bot</h1>
        <p className="text-muted-foreground">Set up a new Telegram bot</p>
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
