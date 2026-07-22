import { useState, useCallback, useEffect } from "react";
import type { Bot, BotPayload, BotStatus, Stats } from "@/types";
import { api } from "@/lib/api";

export function useBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.bots();
      setBots(data);
      const statsMap: Record<string, Stats> = {};
      await Promise.all(
        data.map(async (bot) => {
          try {
            statsMap[bot.id] = await api.stats(bot.id);
          } catch {
            // stats fetch fails silently — card shows "—"
          }
        })
      );
      setStats(statsMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const createBot = useCallback(async (payload: BotPayload) => {
    const bot = await api.createBot(payload);
    await fetchBots();
    return bot;
  }, [fetchBots]);

  const updateBot = useCallback(async (id: string, payload: BotPayload) => {
    const bot = await api.updateBot(id, payload);
    await fetchBots();
    return bot;
  }, [fetchBots]);

  const setStatus = useCallback(async (id: string, status: BotStatus) => {
    await api.setStatus(id, status);
    await fetchBots();
  }, [fetchBots]);

  const deleteBot = useCallback(async (id: string) => {
    await api.deleteBot(id);
    await fetchBots();
  }, [fetchBots]);

  return { bots, stats, loading, error, createBot, updateBot, setStatus, deleteBot, refresh: fetchBots };
}
