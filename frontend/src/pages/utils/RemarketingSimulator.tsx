import * as React from "react";
import { api } from "@/lib/api";
import type { Bot, RemarketingCancelTestResponse } from "@/lib/api";
import BotPicker from "@/components/shared/BotPicker";

export default function RemarketingSimulator() {
  const [bots, setBots] = React.useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = React.useState<Bot | null>(null);
  const [userOrChatId, setUserOrChatId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingBots, setLoadingBots] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RemarketingCancelTestResponse | null>(null);

  React.useEffect(() => {
    let mounted = true;

    api.bots()
      .then((items) => {
        if (mounted) setBots(items);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (mounted) setError(msg);
      })
      .finally(() => {
        if (mounted) setLoadingBots(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!selectedBot) {
      setError("Select a bot first.");
      return;
    }

    const finalUserOrChatId = userOrChatId.trim();
    if (!finalUserOrChatId) {
      setError("Enter a User/Chat ID.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.testRemarketingCancel(selectedBot.id, finalUserOrChatId);
      setResult(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || loadingBots || !selectedBot || !userOrChatId.trim();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <BotPicker bots={bots} selectedBot={selectedBot} onSelect={setSelectedBot} />
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

      {selectedBot && selectedBot.status !== "ACTIVE" ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400 text-sm">
          This bot is <strong>{selectedBot.status.toLowerCase()}</strong>. The simulation may not reflect live bot behavior if the bot is inactive.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isDisabled}
        className={[
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
          isDisabled
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
