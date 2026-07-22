import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Bot, type PaymentFlow } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function BotPaymentAudioPage() {
  const { botId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bot, setBot] = useState<Bot | null>(null);
  const [verifyFailAudios, setVerifyFailAudios] = useState<string[]>([]);
  const [verifySuccessAudios, setVerifySuccessAudios] = useState<string[]>([]);
  const [isVerifyAudioEnabled, setIsVerifyAudioEnabled] = useState(false);
  const [copyPixAudios, setCopyPixAudios] = useState<string[]>([]);
  const [isCopyPixAudioEnabled, setIsCopyPixAudioEnabled] = useState(false);

  const [newVerifyFailId, setNewVerifyFailId] = useState("");
  const [newVerifySuccessId, setNewVerifySuccessId] = useState("");
  const [newCopyAudioId, setNewCopyAudioId] = useState("");

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
        const flow = data.paymentFlow;

        const failRaw = Array.isArray(flow?.verifyPaymentFailAudios)
          ? flow.verifyPaymentFailAudios
          : Array.isArray(flow?.unpaidAudioFileIds)
            ? flow.unpaidAudioFileIds
            : [];
        setVerifyFailAudios(failRaw);
        setVerifySuccessAudios(
          Array.isArray(flow?.verifyPaymentSuccessAudios) ? flow.verifyPaymentSuccessAudios : []
        );
        setIsVerifyAudioEnabled(Boolean(flow?.isVerifyPaymentAudioEnabled));
        setCopyPixAudios(Array.isArray(flow?.copyPixAudios) ? flow.copyPixAudios : []);
        setIsCopyPixAudioEnabled(Boolean(flow?.isCopyPixAudioEnabled));
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

    const currentFailRaw = Array.isArray(currentFlow.verifyPaymentFailAudios)
      ? currentFlow.verifyPaymentFailAudios
      : Array.isArray(currentFlow.unpaidAudioFileIds)
        ? currentFlow.unpaidAudioFileIds
        : [];
    const currentFail = currentFailRaw;
    const currentSuccess = Array.isArray(currentFlow.verifyPaymentSuccessAudios)
      ? currentFlow.verifyPaymentSuccessAudios
      : [];
    const currentCopy = Array.isArray(currentFlow.copyPixAudios) ? currentFlow.copyPixAudios : [];
    const currentVerifyEnabled = Boolean(currentFlow.isVerifyPaymentAudioEnabled);
    const currentCopyEnabled = Boolean(currentFlow.isCopyPixAudioEnabled);

    const arrEqual = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      const sa = [...a].sort();
      const sb = [...b].sort();
      return sa.every((v, i) => v === sb[i]);
    };

    return (
      !arrEqual(currentFail, verifyFailAudios) ||
      !arrEqual(currentSuccess, verifySuccessAudios) ||
      currentVerifyEnabled !== isVerifyAudioEnabled ||
      !arrEqual(currentCopy, copyPixAudios) ||
      currentCopyEnabled !== isCopyPixAudioEnabled
    );
  }, [bot, verifyFailAudios, verifySuccessAudios, isVerifyAudioEnabled, copyPixAudios, isCopyPixAudioEnabled]);

  function addVerifyFailId() {
    const id = newVerifyFailId.trim();
    if (!id) return;
    setVerifyFailAudios((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNewVerifyFailId("");
  }

  function removeVerifyFailId(id: string) {
    setVerifyFailAudios((prev) => prev.filter((x) => x !== id));
  }

  function addVerifySuccessId() {
    const id = newVerifySuccessId.trim();
    if (!id) return;
    setVerifySuccessAudios((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNewVerifySuccessId("");
  }

  function removeVerifySuccessId(id: string) {
    setVerifySuccessAudios((prev) => prev.filter((x) => x !== id));
  }

  function addCopyAudioId() {
    const id = newCopyAudioId.trim();
    if (!id) return;
    setCopyPixAudios((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNewCopyAudioId("");
  }

  function removeCopyAudioId(id: string) {
    setCopyPixAudios((prev) => prev.filter((x) => x !== id));
  }

  async function handleSave() {
    if (!bot || !botId) return;
    setSaving(true);
    setError(null);
    try {
      const flow: PaymentFlow = {
        steps: bot.paymentFlow?.steps ?? [],
        verifyLabel: bot.paymentFlow?.verifyLabel ?? "Verificar pagamento",
        pixCopyLabel: bot.paymentFlow?.pixCopyLabel ?? "Copiar PIX",
        unpaidAudioFileIds: verifyFailAudios,
        verifyPaymentFailAudios: verifyFailAudios,
        verifyPaymentSuccessAudios: verifySuccessAudios,
        isVerifyPaymentAudioEnabled: isVerifyAudioEnabled,
        copyPixAudios: copyPixAudios,
        isCopyPixAudioEnabled: isCopyPixAudioEnabled,
        deliverables: bot.paymentFlow?.deliverables ?? [],
      };
      const updated = await api.updateBot(botId, {
        name: bot.name,
        messageFlow: bot.messageFlow,
        remarketing: bot.remarketing,
        paymentFlow: flow,
      });
      setBot(updated);
      navigate(`/manager/${botId}/payment-settings`);
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
        <h1 className="text-2xl font-semibold">Payment Audios</h1>
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

      <section className="space-y-6">
        {/* Verify Payment Audio Section */}
        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-medium">Audios — Verify Payment</h2>
            <div className="flex items-center gap-2">
              <Switch checked={isVerifyAudioEnabled} onCheckedChange={setIsVerifyAudioEnabled} />
              <span className="text-sm text-muted-foreground">Replace text with audio on verify</span>
            </div>
          </div>

          <div className="p-3 space-y-4">
            {/* Payment Confirmed */}
            <div>
              <h3 className="text-sm font-medium mb-1">Payment Confirmed</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Audios sent when payment is confirmed.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g.: AwADBAADbXXXXXXXXXXXGBdhD2l6_XX..."
                  value={newVerifySuccessId}
                  onChange={(e) => setNewVerifySuccessId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addVerifySuccessId();
                    }
                  }}
                />
                <Button onClick={addVerifySuccessId} disabled={!newVerifySuccessId.trim()}>Add</Button>
              </div>
              <ul className="divide-y mt-3 border-t">
                {loading ? (
                  <li className="p-3 text-sm text-muted-foreground">Loading...</li>
                ) : verifySuccessAudios.length === 0 ? (
                  <li className="p-3 text-sm text-muted-foreground">No audios added.</li>
                ) : (
                  verifySuccessAudios.map((id) => (
                    <li key={id} className="flex items-center justify-between p-3">
                      <code className="truncate text-xs">{id}</code>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(id).catch(() => {})}
                        >
                          Copy
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => removeVerifySuccessId(id)}>
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Payment Not Found */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-1">Payment Not Found</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Audios sent when payment has not been identified yet.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g.: AwADBAADbXXXXXXXXXXXGBdhD2l6_XX..."
                  value={newVerifyFailId}
                  onChange={(e) => setNewVerifyFailId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addVerifyFailId();
                    }
                  }}
                />
                <Button onClick={addVerifyFailId} disabled={!newVerifyFailId.trim()}>Add</Button>
              </div>
              <ul className="divide-y mt-3 border-t">
                {loading ? (
                  <li className="p-3 text-sm text-muted-foreground">Loading...</li>
                ) : verifyFailAudios.length === 0 ? (
                  <li className="p-3 text-sm text-muted-foreground">No audios added.</li>
                ) : (
                  verifyFailAudios.map((id) => (
                    <li key={id} className="flex items-center justify-between p-3">
                      <code className="truncate text-xs">{id}</code>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(id).catch(() => {})}
                        >
                          Copy
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => removeVerifyFailId(id)}>
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Copy Pix Key Audio Section */}
        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-medium">Audios — Copy Pix Key</h2>
            <div className="flex items-center gap-2">
              <Switch checked={isCopyPixAudioEnabled} onCheckedChange={setIsCopyPixAudioEnabled} />
              <span className="text-sm text-muted-foreground">Send an audio alongside the Copy PIX button</span>
            </div>
          </div>
          <div className="p-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              When enabled, a random audio is sent as an extra message alongside the payment flow.
              The copy button always uses native copy — never replaced.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="e.g.: AwADBAADbXXXXXXXXXXXGBdhD2l6_XX..."
                value={newCopyAudioId}
                onChange={(e) => setNewCopyAudioId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCopyAudioId();
                  }
                }}
              />
              <Button onClick={addCopyAudioId} disabled={!newCopyAudioId.trim()}>Add</Button>
            </div>
          </div>

          <ul className="divide-y">
            {loading ? (
              <li className="p-3 text-sm text-muted-foreground">Loading...</li>
            ) : copyPixAudios.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">No audios added.</li>
            ) : (
              copyPixAudios.map((id) => (
                <li key={id} className="flex items-center justify-between p-3">
                  <code className="truncate text-xs">{id}</code>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(id).catch(() => {})}
                    >
                      Copy
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeCopyAudioId(id)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}
