import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Bot, type MessageStep } from "@/lib/api";
import { Button } from "@/components/ui/button";
import MessageFlowEditor from "@/components/forms/MessageFlowEditor";

export default function BotDeliverablesPage() {
  const { botId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bot, setBot] = useState<Bot | null>(null);
  const [deliverables, setDeliverables] = useState<MessageStep[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!botId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await api.getBot(botId);
        if (!active) return;
        setBot(data);
        setDeliverables(
          Array.isArray(data.paymentFlow?.deliverables)
            ? data.paymentFlow.deliverables
            : []
        );
      } catch (e) {
        if (!active) return;
        const message = e instanceof Error ? e.message : "Failed to load bot";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [botId]);

  const dirty = useMemo(() => {
    if (!bot) return false;
    const current = Array.isArray(bot.paymentFlow?.deliverables)
      ? bot.paymentFlow.deliverables
      : [];
    return JSON.stringify(current) !== JSON.stringify(deliverables);
  }, [bot, deliverables]);

  async function handleSave() {
    if (!bot || !botId) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateBot(botId, {
        name: bot.name,
        messageFlow: bot.messageFlow,
        remarketing: bot.remarketing,
        paymentFlow: {
          steps: bot.paymentFlow?.steps ?? [],
          verifyLabel: bot.paymentFlow?.verifyLabel ?? "Verificar pagamento",
          pixCopyLabel: bot.paymentFlow?.pixCopyLabel ?? "Copiar PIX",
          verifyPaymentSuccessFlow: bot.paymentFlow?.verifyPaymentSuccessFlow ?? [],
          verifyPaymentFailFlow: bot.paymentFlow?.verifyPaymentFailFlow ?? [],
          copyPixFlow: bot.paymentFlow?.copyPixFlow ?? [],
          deliverables,
        },
      });
      setBot(updated);
      navigate(`/manager/${botId}/payment-settings`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save deliverables";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!botId) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">Bot ID missing.</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deliverables</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
          <Button onClick={handleSave} disabled={!dirty || saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-border/40 bg-card p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Messages sent to the user after a payment is confirmed. Each step can include
          text, media, delays, and buttons.
        </p>

        <MessageFlowEditor
          steps={deliverables}
          onChange={setDeliverables}
          showPaymentOptions={false}
          livepixConfigured={false}
        />
      </div>
    </main>
  );
}
