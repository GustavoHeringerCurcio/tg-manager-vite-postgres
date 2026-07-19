import { useParams, Link } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Activity, Send, MousePointerClick, CreditCard,
  UserCheck, MessageCircle, ArrowLeftRight, Workflow,
} from "lucide-react";

const statCards = [
  {
    key: "totalUsers",
    icon: Users,
    label: "Total Users",
    gradient: "from-sky-500/15 to-sky-500/5",
    iconColor: "text-sky-400",
    ringColor: "ring-sky-500/20",
  },
  {
    key: "totalInteractions",
    icon: Activity,
    label: "Interactions",
    gradient: "from-violet-500/15 to-violet-500/5",
    iconColor: "text-violet-400",
    ringColor: "ring-violet-500/20",
  },
  {
    key: "messageCount",
    icon: Send,
    label: "Messages Sent",
    gradient: "from-emerald-500/15 to-emerald-500/5",
    iconColor: "text-emerald-400",
    ringColor: "ring-emerald-500/20",
  },
  {
    key: "callbackCount",
    icon: MousePointerClick,
    label: "Callbacks",
    gradient: "from-amber-500/15 to-amber-500/5",
    iconColor: "text-amber-400",
    ringColor: "ring-amber-500/20",
  },
  {
    key: "checkoutClicks",
    icon: CreditCard,
    label: "Checkout Clicks",
    gradient: "from-rose-500/15 to-rose-500/5",
    iconColor: "text-rose-400",
    ringColor: "ring-rose-500/20",
  },
  {
    key: "dailyActiveUsers",
    icon: UserCheck,
    label: "Daily Active",
    gradient: "from-cyan-500/15 to-cyan-500/5",
    iconColor: "text-cyan-400",
    ringColor: "ring-cyan-500/20",
  },
];

export default function BotDashboardPage() {
  const { botId } = useParams<{ botId: string }>();
  const { bot, stats, loading, error } = useBotDetail(botId);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-shimmer">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 animate-fade-in">
        <p className="text-destructive">{error || "Bot not found"}</p>
        <Button variant="outline" render={<Link to="/manager" />}>Back to Bots</Button>
      </div>
    );
  }

  const values: Record<string, number> = {
    totalUsers: stats?.totalUsers ?? 0,
    totalInteractions: stats?.totalInteractions ?? 0,
    messageCount: stats?.messageCount ?? 0,
    callbackCount: stats?.callbackCount ?? 0,
    checkoutClicks: stats?.checkoutClicks ?? 0,
    dailyActiveUsers: stats?.dailyActiveUsers ?? 0,
  };

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-stagger">
        {statCards.map(({ key, icon: Icon, label, gradient, iconColor, ringColor }) => (
          <Card
            key={key}
            className={`group relative overflow-hidden transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 ring-1 ring-border/50 ${ringColor}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50`} />
            <CardContent className="relative p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {label}
                </p>
                <div className={`flex size-8 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm ring-1 ring-border/30 ${ringColor}`}>
                  <Icon className={`size-4 ${iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight tabular-nums">
                {values[key].toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                {label === "Checkout Clicks" ? "purchases" : "all time"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
