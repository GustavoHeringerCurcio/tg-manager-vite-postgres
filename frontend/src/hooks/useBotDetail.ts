import { useState, useCallback, useEffect } from "react";
import type { Bot, Stats } from "@/types";
import { api } from "@/lib/api";

export function useBotDetail(botId: string | undefined) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const bots = await api.bots();
      const found = bots.find((b) => b.id === botId) ?? null;
      setBot(found);
      try {
        const s = await api.stats(botId);
        setStats(s);
      } catch {
        setStats(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bot");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { bot, stats, loading, error, refresh: fetchAll };
}
