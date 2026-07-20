import { useParams, useNavigate } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { useBots } from "@/hooks/useBots";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { BotPayload, PaymentFlow } from "@/types";
import PaymentFlowEditor from "@/components/forms/PaymentFlowEditor";

const defaultPaymentFlow: PaymentFlow = {
  steps: [],
  verifyLabel: "Verificar pagamento",
  pixCopyLabel: "Copiar PIX",
};

export default function BotPaymentPage() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { bot, loading, error, refresh } = useBotDetail(botId);
  const { updateBot } = useBots();
  const [saving, setSaving] = useState(false);
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow | null>(null);

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

  const currentFlow = paymentFlow ?? bot?.paymentFlow ?? defaultPaymentFlow;

  async function handleSave() {
    if (!botId || !bot) return;
    setSaving(true);
    try {
      const payload: BotPayload = {
        name: bot.name,
        messageFlow: bot.messageFlow,
        remarketing: bot.remarketing,
        paymentFlow: currentFlow,
      };
      await updateBot(botId, payload);
      toast.success("Payment flow updated");
      refresh();
      setPaymentFlow(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update payment flow");
    } finally {
      setSaving(false);
    }
  }

  const isDirty = paymentFlow !== null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <CreditCard className="size-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Payment Flow</h1>
          <p className="text-sm text-muted-foreground">
            Configure payment responses for {bot.name}
          </p>
        </div>
      </div>

      <PaymentFlowEditor
        paymentFlow={currentFlow}
        onChange={setPaymentFlow}
      />

      <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background/80 backdrop-blur-xl border-t flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="flex size-1.5 rounded-full bg-amber-400 animate-pulse-dot" />
              Unsaved changes
            </span>
          ) : (
            <p className="text-xs text-muted-foreground">
              {saving ? "Saving..." : "All changes saved"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(`/manager/${botId}/dashboard`)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !isDirty} className="min-w-32 shadow-glow-primary">
            <Save className="mr-1.5 size-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
