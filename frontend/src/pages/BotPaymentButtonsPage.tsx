import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Bot, type MessageStep, type PaymentFlow } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import MessageFlowEditor from "@/components/forms/MessageFlowEditor";

export default function BotPaymentButtonsPage() {
  const { botId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bot, setBot] = useState<Bot | null>(null);

  const [verifyLabel, setVerifyLabel] = useState("Verificar pagamento");
  const [pixCopyLabel, setPixCopyLabel] = useState("Copiar PIX");
  const [verifySuccessFlow, setVerifySuccessFlow] = useState<MessageStep[]>([]);
  const [verifyFailFlow, setVerifyFailFlow] = useState<MessageStep[]>([]);
  const [copyPixFlow, setCopyPixFlow] = useState<MessageStep[]>([]);

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
        const flow = data.paymentFlow ?? ({} as PaymentFlow);
        setVerifyLabel(flow.verifyLabel ?? "Verificar pagamento");
        setPixCopyLabel(flow.pixCopyLabel ?? "Copiar PIX");
        setVerifySuccessFlow(
          Array.isArray(flow.verifyPaymentSuccessFlow) ? flow.verifyPaymentSuccessFlow : []
        );
        setVerifyFailFlow(
          Array.isArray(flow.verifyPaymentFailFlow) ? flow.verifyPaymentFailFlow : []
        );
        setCopyPixFlow(
          Array.isArray(flow.copyPixFlow) ? flow.copyPixFlow : []
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
    const currentFlow = bot.paymentFlow ?? ({} as PaymentFlow);
    const currentVerify = currentFlow.verifyLabel ?? "Verificar pagamento";
    const currentCopy = currentFlow.pixCopyLabel ?? "Copiar PIX";
    const currentSuccess = Array.isArray(currentFlow.verifyPaymentSuccessFlow)
      ? currentFlow.verifyPaymentSuccessFlow
      : [];
    const currentFail = Array.isArray(currentFlow.verifyPaymentFailFlow)
      ? currentFlow.verifyPaymentFailFlow
      : [];
    const currentCopyFlow = Array.isArray(currentFlow.copyPixFlow)
      ? currentFlow.copyPixFlow
      : [];

    return (
      verifyLabel !== currentVerify ||
      pixCopyLabel !== currentCopy ||
      JSON.stringify(verifySuccessFlow) !== JSON.stringify(currentSuccess) ||
      JSON.stringify(verifyFailFlow) !== JSON.stringify(currentFail) ||
      JSON.stringify(copyPixFlow) !== JSON.stringify(currentCopyFlow)
    );
  }, [bot, verifyLabel, pixCopyLabel, verifySuccessFlow, verifyFailFlow, copyPixFlow]);

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
          verifyLabel,
          pixCopyLabel,
          verifyPaymentSuccessFlow: verifySuccessFlow,
          verifyPaymentFailFlow: verifyFailFlow,
          copyPixFlow,
          deliverables: bot.paymentFlow?.deliverables ?? [],
        },
      });
      setBot(updated);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save settings";
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
        <h1 className="text-2xl font-semibold">Payment Buttons</h1>
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

      <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Telegram Preview
        </p>
        <div className="max-w-xs mx-auto">
          <div className="rounded-xl border border-border/40 bg-background px-3 pt-2.5 pb-3 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                B
              </div>
              <div>
                <span className="text-[11px] font-semibold text-sky-500">
                  Botflix Bot
                </span>
              </div>
            </div>
            <div className="mt-2 rounded-xl bg-muted/40 px-3 py-2">
              <p className="text-xs text-foreground/80 leading-relaxed">
                Seu pagamento est&aacute; sendo processado...
              </p>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              <div className="flex-1 rounded-lg bg-sky-500 px-1.5 py-2 text-center">
                <span className="text-[11px] font-medium text-white break-all leading-tight">
                  {verifyLabel}
                </span>
              </div>
              <div className="flex-1 rounded-lg bg-green-500 px-1.5 py-2 text-center">
                <span className="text-[11px] font-medium text-white break-all leading-tight">
                  {pixCopyLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-center mt-3 italic">
          These two buttons appear in the last message of your payment flow
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left column — Verify Payment */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex size-3 items-center justify-center rounded bg-sky-500 text-[8px] font-bold text-white">
              &#x2713;
            </span>
            <h2 className="text-sm font-semibold">Verify Payment</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-label" className="text-xs">Button Label</Label>
            <Input
              id="verify-label"
              value={verifyLabel}
              onChange={(e) => setVerifyLabel(e.target.value)}
              className="h-9 text-sm"
              placeholder="Verificar pagamento"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">Payment Confirmed</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Steps sent when payment is confirmed. If empty, a default text message is sent instead.
            </p>
            <MessageFlowEditor
              steps={verifySuccessFlow}
              onChange={setVerifySuccessFlow}
              showPaymentOptions={false}
              livepixConfigured={false}
            />
          </div>

          <hr className="border-border/40" />

          <div>
            <h3 className="text-sm font-medium mb-1">Payment Not Found</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Steps sent when payment has not been identified yet. If empty, a default alert is shown.
            </p>
            <MessageFlowEditor
              steps={verifyFailFlow}
              onChange={setVerifyFailFlow}
              showPaymentOptions={false}
              livepixConfigured={false}
            />
          </div>
        </div>

        {/* Right column — Copy PIX */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex size-3 items-center justify-center rounded bg-green-500 text-[8px] font-bold text-white">
              &#x1F4CB;
            </span>
            <h2 className="text-sm font-semibold">Copy PIX</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="copy-label" className="text-xs">Button Label</Label>
            <Input
              id="copy-label"
              value={pixCopyLabel}
              onChange={(e) => setPixCopyLabel(e.target.value)}
              className="h-9 text-sm"
              placeholder="Copiar PIX"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-1">Copy PIX Response</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Steps sent alongside the native copy action. The PIX code is always copied — these steps are supplementary.
            </p>
            <MessageFlowEditor
              steps={copyPixFlow}
              onChange={setCopyPixFlow}
              showPaymentOptions={false}
              livepixConfigured={false}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
