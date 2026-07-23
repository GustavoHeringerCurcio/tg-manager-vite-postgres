import { useState, useCallback, useEffect, useRef } from "react";
import { api, type DashboardPeriod, type DashboardStatsResponse } from "@/lib/api";

export function useDashboardStats(
  botId: string | undefined,
  period: DashboardPeriod
) {
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const fetchData = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.dashboardStats(botId, period);
      if (!mounted.current) return;
      setData(result);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to load dashboard stats");
    } finally {
      if (!mounted.current) return;
      setLoading(false);
    }
  }, [botId, period.from, period.to, period.granularity]);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    return () => {
      mounted.current = false;
    };
  }, [fetchData]);

  function computeStat(key: keyof DashboardStatsResponse["stats"]): {
    value: number;
    previousValue: number;
    changePercent: number | null;
  } {
    if (!data) return { value: 0, previousValue: 0, changePercent: null };

    const current = data.stats[key];
    const previous = data.previousStats?.[key] ?? 0;

    let changePercent: number | null = null;
    if (previous !== 0) {
      changePercent = ((current - previous) / previous) * 100;
    }

    return { value: current, previousValue: previous, changePercent };
  }

  return {
    stats: data?.stats ?? null,
    timeline: data?.timeline ?? [],
    dailyActiveUsers: data?.dailyActiveUsers ?? 0,
    computeStat,
    loading,
    error,
    refresh: fetchData,
  };
}
