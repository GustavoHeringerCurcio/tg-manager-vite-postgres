import * as React from "react";
import { api, Bot, LoadSimulationResult } from "@/lib/api";

export default function LoadSimulator() {
  const [bots, setBots] = React.useState<Bot[]>([]);
  const [botId, setBotId] = React.useState<string>("");
  const [concurrentUsers, setConcurrentUsers] = React.useState<number>(5);
  const [simulateStart, setSimulateStart] = React.useState<boolean>(true);
  const [simulateCopyPix, setSimulateCopyPix] = React.useState<boolean>(false);
  const [simulateCheckPayment, setSimulateCheckPayment] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [result, setResult] = React.useState<LoadSimulationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    api.bots()
      .then((list) => {
        if (!alive) return;
        setBots(list);
        if (!botId && list.length > 0) setBotId(list[0].id);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load bots");
      });
    return () => {
      alive = false;
    };
  }, []);

  const onExecute = async () => {
    setError(null);
    setResult(null);
    if (!botId) {
      setError("Selecione um bot.");
      return;
    }
    const actions: Array<"start" | "copy_pix" | "check_payment"> = [];
    if (simulateStart) actions.push("start");
    if (simulateCopyPix) actions.push("copy_pix");
    if (simulateCheckPayment) actions.push("check_payment");
    if (actions.length === 0) {
      setError("Selecione pelo menos uma ação para simular.");
      return;
    }
    if (concurrentUsers < 1) {
      setError("Número de usuários concorrentes deve ser pelo menos 1.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.simulateLoad({ botId, concurrentUsers, actions });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na simulação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Selecione o Bot</label>
          <select
            className="w-full rounded-md border bg-background p-2"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            disabled={loading}
          >
            {bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Número de Usuários Concorrentes</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border bg-background p-2"
            value={concurrentUsers}
            onChange={(e) => setConcurrentUsers(Math.max(0, Number(e.target.value || 0)))}
            disabled={loading}
          />
          {concurrentUsers > 20 && (
            <div className="mt-1 flex items-start gap-2 rounded-md border border-yellow-400 bg-yellow-50 p-2 text-sm text-yellow-800">
              <span aria-hidden>⚠️</span>
              <span>
                Este valor é alto e pode ser perigoso devido às requisições do LivePix. Tem certeza que deseja continuar?
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulateStart}
            onChange={(e) => setSimulateStart(e.target.checked)}
            disabled={loading}
          />
          <span className="text-sm">Simular comando /start</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulateCopyPix}
            onChange={(e) => setSimulateCopyPix(e.target.checked)}
            disabled={loading}
          />
          <span className="text-sm">Simular ação Copy Pix</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulateCheckPayment}
            onChange={(e) => setSimulateCheckPayment(e.target.checked)}
            disabled={loading}
          />
          <span className="text-sm">Simular ação Check Payment</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
          onClick={onExecute}
          disabled={loading || !botId}
        >
          {loading ? "Executando..." : "Executar"}
        </button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold">Resultados</h3>
        {!result && !loading && <p className="text-sm text-muted-foreground">Nenhuma simulação executada ainda.</p>}
        {result && (
          <div className="mt-2 grid gap-2 text-sm">
            <div>
              <span className="font-medium">Tempo total:</span> {(result.durationMs / 1000).toFixed(2)}s
            </div>
            <div className="flex gap-4">
              <div><span className="font-medium">Enviados:</span> {result.totalSent}</div>
              <div className="text-green-600"><span className="font-medium">Sucessos:</span> {result.succeeded}</div>
              <div className="text-red-600"><span className="font-medium">Falhas:</span> {result.failed}</div>
            </div>
            {result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer">Ver erros ({result.errors.length})</summary>
                <ul className="mt-2 list-disc pl-5">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      Usuário {e.userId} • Ação {e.action} • Erro: {e.error}
                    </li>
                  ))}
                  {result.errors.length > 20 && (
                    <li>... e mais {result.errors.length - 20} erros</li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
