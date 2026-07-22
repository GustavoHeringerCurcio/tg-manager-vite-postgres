import { useState, useCallback, useEffect, useRef } from "react";
import type { Bot } from "@/types";
import { api } from "@/lib/api";

export function useBotDetail(botId: string | undefined) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latestRequest = useRef<symbol | null>(null);
  const mounted = useRef(true);

  const fetchBot = useCallback(async () => {
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
    fetchBot();
    return () => {
      mounted.current = false;
    };
  }, [fetchBot]);

  return { bot, loading, error, refresh: fetchBot };
}
