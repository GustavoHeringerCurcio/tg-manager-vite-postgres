import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PeriodFilter from "@/components/shared/PeriodFilter";
import StatCard from "@/components/bots/StatCard";
import SalesCharts from "@/components/bots/SalesCharts";
import {
  Users, Activity, Send, MousePointerClick, CreditCard,
  UserCheck, MessageCircle, ArrowLeftRight, Workflow,
  DollarSign, TrendingUp, ShoppingCart,
} from "lucide-react";
import type { DashboardPeriod } from "@/lib/api";

function defaultPeriod(): DashboardPeriod {
  const now = new Date();
  return {
    from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: now.toISOString(),
    granularity: "daily",
  };
}

export default function BotDashboardPage() {
  const { botId } = useParams<{ botId: string }>();
  const { bot, loading: botLoading } = useBotDetail(botId);
  const [period, setPeriod] = useState<DashboardPeriod>(defaultPeriod);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { stats, timeline, dailyActiveUsers, computeStat, loading: statsLoading, error } = useDashboardStats(
    botId,
    period,
    autoRefresh,
  );

  const loading = botLoading || (statsLoading && !stats);

  if (botLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 p-5 space-y-3 animate-shimmer">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 animate-fade-in">
        <p className="text-destructive">Bot not found</p>
        <Button variant="outline" render={<Link to="/manager" />}>Back to Bots</Button>
      </div>
    );
  }

  const rev = computeStat("totalRevenue");
  const us = computeStat("totalUsers");
  const conv = computeStat("conversionRate");
  const int_ = computeStat("totalInteractions");
  const ord = computeStat("orders");
  const msg = computeStat("messageCount");
  const cb = computeStat("callbackCount");

  const statCards = [
    {
      key: "revenue",
      icon: DollarSign,
      label: "Revenue",
      value: rev.value,
      previousValue: rev.previousValue,
      changePercent: rev.changePercent,
      format: "currency" as const,
      subtitle: undefined,
      iconColor: "text-emerald-400",
      gradient: "from-emerald-500/15 to-emerald-500/5",
      ringColor: "ring-emerald-500/20",
    },
    {
      key: "users",
      icon: Users,
      label: "Active Users",
      value: us.value,
      previousValue: us.previousValue,
      changePercent: us.changePercent,
      format: "number" as const,
      subtitle: undefined,
      iconColor: "text-sky-400",
      gradient: "from-sky-500/15 to-sky-500/5",
      ringColor: "ring-sky-500/20",
    },
    {
      key: "conversion",
      icon: TrendingUp,
      label: "Conversion Rate",
      value: conv.value,
      previousValue: conv.previousValue,
      changePercent: conv.changePercent,
      format: "percent" as const,
      subtitle: "checkout ÷ interactions",
      iconColor: "text-amber-400",
      gradient: "from-amber-500/15 to-amber-500/5",
      ringColor: "ring-amber-500/20",
    },
    {
      key: "interactions",
      icon: Activity,
      label: "Interactions",
      value: int_.value,
      previousValue: int_.previousValue,
      changePercent: int_.changePercent,
      format: "number" as const,
      subtitle: undefined,
      iconColor: "text-violet-400",
      gradient: "from-violet-500/15 to-violet-500/5",
      ringColor: "ring-violet-500/20",
    },
    {
      key: "orders",
      icon: ShoppingCart,
      label: "Orders",
      value: ord.value,
      previousValue: ord.previousValue,
      changePercent: ord.changePercent,
      format: "number" as const,
      subtitle: "completed",
      iconColor: "text-rose-400",
      gradient: "from-rose-500/15 to-rose-500/5",
      ringColor: "ring-rose-500/20",
    },
    {
      key: "messages",
      icon: Send,
      label: "Messages Sent",
      value: msg.value,
      previousValue: msg.previousValue,
      changePercent: msg.changePercent,
      format: "number" as const,
      subtitle: undefined,
      iconColor: "text-cyan-400",
      gradient: "from-cyan-500/15 to-cyan-500/5",
      ringColor: "ring-cyan-500/20",
    },
    {
      key: "callbacks",
      icon: MousePointerClick,
      label: "Callbacks",
      value: cb.value,
      previousValue: cb.previousValue,
      changePercent: cb.changePercent,
      format: "number" as const,
      subtitle: undefined,
      iconColor: "text-orange-400",
      gradient: "from-orange-500/15 to-orange-500/5",
      ringColor: "ring-orange-500/20",
    },
    {
      key: "dau",
      icon: UserCheck,
      label: "Daily Active",
      value: dailyActiveUsers,
      previousValue: 0,
      changePercent: null,
      format: "number" as const,
      subtitle: "last 24h",
      iconColor: "text-indigo-400",
      gradient: "from-indigo-500/15 to-indigo-500/5",
      ringColor: "ring-indigo-500/20",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Send className="size-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{bot.name}</h1>
              <StatusBadge status={bot.status} />
            </div>
            <p className="text-xs text-muted-foreground">Bot ID: {bot.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" render={<Link to={`/manager/${botId}/messages`} />}>
            <Workflow className="mr-1.5 size-3.5" /> Messages
          </Button>
          <Button variant="outline" size="sm" render={<Link to={`/manager/${botId}/transactions`} />}>
            <ArrowLeftRight className="mr-1.5 size-3.5" /> Transactions
          </Button>
          <Button variant="outline" size="sm" render={<Link to={`/manager/${botId}/interactions`} />}>
            <MessageCircle className="mr-1.5 size-3.5" /> Interactions
          </Button>
        </div>
      </div>

      <PeriodFilter
        value={period}
        autoRefresh={autoRefresh}
        onPeriodChange={setPeriod}
        onAutoRefreshChange={setAutoRefresh}
      />

      {error ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-stagger">
            {statCards.map((card) => (
              <StatCard
                key={card.key}
                icon={card.icon}
                label={card.label}
                value={card.value}
                previousValue={card.previousValue}
                changePercent={card.changePercent}
                format={card.format}
                subtitle={card.subtitle}
                iconColor={card.iconColor}
                gradient={card.gradient}
                ringColor={card.ringColor}
              />
            ))}
          </div>

          <SalesCharts timeline={timeline} granularity={period.granularity} />
        </>
      )}
    </div>
  );
}
