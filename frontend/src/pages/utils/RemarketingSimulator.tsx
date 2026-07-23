import * as React from "react";

type ApiResponse = {
  ok: boolean;
  error?: string;
  botId?: string;
  userId?: string;
  telegramId?: string | null;
  createdMock?: boolean;
  cancelledCount?: number;
  remainingExists?: boolean;
  cancelled?: boolean;
};

export default function RemarketingSimulator() {
  const [botId, setBotId] = React.useState("");
  const [userOrChatId, setUserOrChatId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ApiResponse | null>(null);

  const onSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/utils/test-remarketing-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ botId, userOrChatId }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || `Request failed with status ${res.status}`);
      } else {
        setResult(json);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Bot ID</label>
          <input
            type="text"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            placeholder="ex: bot_123"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">User/Chat ID</label>
          <input
            type="text"
            value={userOrChatId}
            onChange={(e) => setUserOrChatId(e.target.value)}
            placeholder="ex: user_uuid ou Telegram chat id"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={[
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
          loading
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:opacity-90",
        ].join(" ")}
      >
        {loading ? "Testando..." : "Testar Cancelamento de Remarketing"}
      </button>

      <div className="mt-4 space-y-2">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-sm font-semibold mb-1">Resultado</div>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </form>
  );
}
