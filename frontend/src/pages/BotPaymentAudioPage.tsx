import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Bot, type PaymentFlow } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function BotPaymentAudioPage() {
  const { botId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bot, setBot] = useState<Bot | null>(null);
  const [audioIds, setAudioIds] = useState<string[]>([]);
  const [newAudioId, setNewAudioId] = useState("");

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
        setAudioIds(Array.isArray(flow?.unpaidAudioFileIds) ? flow.unpaidAudioFileIds : []);
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
    const current = Array.isArray(bot.paymentFlow?.unpaidAudioFileIds) ? bot.paymentFlow.unpaidAudioFileIds : [];
    if (current.length !== audioIds.length) return true;
    const a = [...current].sort();
    const b = [...audioIds].sort();
    return a.some((v, i) => v !== b[i]);
  }, [bot, audioIds]);

  function addAudioId() {
    const id = newAudioId.trim();
    if (!id) return;
    setAudioIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setNewAudioId("");
  }

  function removeAudioId(id: string) {
    setAudioIds((prev) => prev.filter((x) => x !== id));
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
        // Update audio IDs
        unpaidAudioFileIds: audioIds,
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
      const message = e instanceof Error ? e.message : "Failed to save audio IDs";
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

      <section className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Adicione os file_ids de mensagens de voz do Telegram para usar quando o pagamento ainda não foi identificado.
        </p>

        <div className="flex gap-2">
          <Input
            placeholder="Ex.: AwADBAADbXXXXXXXXXXXGBdhD2l6_XX..."
            value={newAudioId}
            onChange={(e) => setNewAudioId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAudioId();
              }
            }}
          />
          <Button onClick={addAudioId} disabled={!newAudioId.trim()}>Adicionar</Button>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b">
            <h2 className="font-medium">Lista de áudios</h2>
          </div>
          <ul className="divide-y">
            {loading ? (
              <li className="p-3 text-sm text-muted-foreground">Carregando...</li>
            ) : audioIds.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">Nenhum áudio adicionado.</li>
            ) : (
              audioIds.map((id) => (
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
                    <Button variant="destructive" size="sm" onClick={() => removeAudioId(id)}>
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
