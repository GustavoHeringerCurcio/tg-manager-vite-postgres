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
  const [verifyPaymentAudios, setVerifyPaymentAudios] = useState<string[]>([]);
  const [copyPixAudios, setCopyPixAudios] = useState<string[]>([]);
  const [isCopyPixAudioEnabled, setIsCopyPixAudioEnabled] = useState(false);
  const [newVerifyAudioId, setNewVerifyAudioId] = useState("");
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
        const verify = Array.isArray(flow?.verifyPaymentAudios)
          ? flow.verifyPaymentAudios
          : Array.isArray(flow?.unpaidAudioFileIds)
            ? flow.unpaidAudioFileIds
            : [];
        setVerifyPaymentAudios(verify);
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
    const currentVerify = Array.isArray(currentFlow.verifyPaymentAudios)
      ? currentFlow.verifyPaymentAudios
      : Array.isArray(currentFlow.unpaidAudioFileIds)
        ? currentFlow.unpaidAudioFileIds
        : [];
    const currentCopy = Array.isArray(currentFlow.copyPixAudios) ? currentFlow.copyPixAudios : [];
    const currentEnabled = Boolean(currentFlow.isCopyPixAudioEnabled);

    const arrEqual = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      const sa = [...a].sort();
      const sb = [...b].sort();
      return sa.every((v, i) => v === sb[i]);
    };

    return (
      !arrEqual(currentVerify, verifyPaymentAudios) ||
      !arrEqual(currentCopy, copyPixAudios) ||
      currentEnabled !== isCopyPixAudioEnabled
    );
  }, [bot, verifyPaymentAudios, copyPixAudios, isCopyPixAudioEnabled]);

  function addVerifyAudioId() {
    const id = newVerifyAudioId.trim();
    if (!id) return;
    setVerifyPaymentAudios((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNewVerifyAudioId("");
  }

  function removeVerifyAudioId(id: string) {
    setVerifyPaymentAudios((prev) => prev.filter((x) => x !== id));
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
        // Preserve existing fields
        steps: bot.paymentFlow?.steps ?? [],
        verifyLabel: bot.paymentFlow?.verifyLabel ?? "Verificar pagamento",
        pixCopyLabel: bot.paymentFlow?.pixCopyLabel ?? "Copiar PIX",
        // New explicit fields
        verifyPaymentAudios: verifyPaymentAudios,
        copyPixAudios: copyPixAudios,
        isCopyPixAudioEnabled: isCopyPixAudioEnabled,
        // Backwards compatibility with older field
        unpaidAudioFileIds: verifyPaymentAudios,
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
      <main className="container mx-auto p-6">
        <p className="text-sm text-muted-foreground">Bot ID ausente.</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Áudios de Cobrança</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigate(-1)}>Voltar</Button>
          <Button onClick={handleSave} disabled={!dirty || saving || loading}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      ) : null}

      <section className="space-y-6">
        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b">
            <h2 className="font-medium">Áudios - Verificar Pagamento</h2>
          </div>
          <div className="p-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Áudios enviados quando o usuário clica em 'Verificar pagamento'.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="Ex.: AwADBAADbXXXXXXXXXXXGBdhD2l6_XX..."
                value={newVerifyAudioId}
                onChange={(e) => setNewVerifyAudioId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addVerifyAudioId();
                  }
                }}
              />
              <Button onClick={addVerifyAudioId} disabled={!newVerifyAudioId.trim()}>Adicionar</Button>
            </div>
          </div>

          <ul className="divide-y">
            {loading ? (
              <li className="p-3 text-sm text-muted-foreground">Carregando...</li>
            ) : verifyPaymentAudios.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">Nenhum áudio adicionado.</li>
            ) : (
              verifyPaymentAudios.map((id) => (
                <li key={id} className="flex items-center justify-between p-3">
                  <code className="truncate text-xs">{id}</code>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(id).catch(() => {})}
                    >
                      Copiar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeVerifyAudioId(id)}>
                      Remover
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-medium">Áudios - Copiar Chave Pix</h2>
            <div className="flex items-center gap-2">
              <Switch checked={isCopyPixAudioEnabled} onCheckedChange={setIsCopyPixAudioEnabled} />
              <span className="text-sm text-muted-foreground">Ativar envio de áudio ao copiar Pix</span>
            </div>
          </div>
          <div className="p-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Áudios enviados quando o usuário clica em 'Copiar chave pix'.
            </p>

            <div className="flex gap-2">
              <Input
                placeholder="Ex.: AwADBAADbXXXXXXXXXXXGBdhD2l6_XX..."
                value={newCopyAudioId}
                onChange={(e) => setNewCopyAudioId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCopyAudioId();
                  }
                }}
              />
              <Button onClick={addCopyAudioId} disabled={!newCopyAudioId.trim()}>Adicionar</Button>
            </div>
          </div>

          <ul className="divide-y">
            {loading ? (
              <li className="p-3 text-sm text-muted-foreground">Carregando...</li>
            ) : copyPixAudios.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">Nenhum áudio adicionado.</li>
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
                      Copiar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => removeCopyAudioId(id)}>
                      Remover
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
