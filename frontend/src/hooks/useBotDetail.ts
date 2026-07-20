import { useState, useCallback, useEffect, useRef } from "react";
import type { Bot, Stats } from "@/types";
import { api } from "@/lib/api";

export function useBotDetail(botId: string | undefined) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latestRequest = useRef<symbol | null>(null);
  const mounted = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);

    const req = Symbol();
    latestRequest.current = req;

    try {
      const bots = await api.bots();
      if (!mounted.current || latestRequest.current !== req) return;

      const found = bots.find((b) => b.id === botId) ?? null;
      setBot(found);

      try {
        const s = await api.stats(botId);
        if (!mounted.current || latestRequest.current !== req) return;
        setStats(s);
      } catch {
        if (!mounted.current || latestRequest.current !== req) return;
        setStats(null);
      }
    } catch (err) {
      if (!mounted.current || latestRequest.current !== req) return;
      setError(err instanceof Error ? err.message : "Failed to fetch bot");
    } finally {
      if (!mounted.current || latestRequest.current !== req) return;
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    mounted.current = true;
    fetchAll();
    return () => {
      mounted.current = false;
    };
  }, [fetchAll]);

  return { bot, stats, loading, error, refresh: fetchAll };
}
