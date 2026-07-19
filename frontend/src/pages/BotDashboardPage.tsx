import { useParams, Link } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Activity, Send, MousePointerClick, CreditCard, UserCheck, MessageCircle, ArrowLeftRight } from "lucide-react";

const statStyles = [
  { icon: Users, label: "Total Users", color: "shadow-card border-t-2 border-t-primary/60" },
  { icon: Activity, label: "Total Interactions", color: "shadow-card border-t-2 border-t-sky-400/60" },
  { icon: Send, label: "Messages Sent", color: "shadow-card border-t-2 border-t-violet-400/60" },
  { icon: MousePointerClick, label: "Callbacks", color: "shadow-card border-t-2 border-t-amber-400/60" },
  { icon: CreditCard, label: "Checkout Clicks", color: "shadow-card border-t-2 border-t-emerald-400/60" },
  { icon: UserCheck, label: "Daily Active Users", color: "shadow-card border-t-2 border-t-rose-400/60" },
];

export default function BotDashboardPage() {
  const { botId } = useParams<{ botId: string }>();
  const { bot, stats, loading, error } = useBotDetail(botId);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-8 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-destructive">{error || "Bot not found"}</p>
        <Button variant="outline" render={<Link to="/manager" />}>Back to Bots</Button>
      </div>
    );
  }

  const values = [
    stats?.totalUsers ?? 0,
    stats?.totalInteractions ?? 0,
    stats?.messageCount ?? 0,
    stats?.callbackCount ?? 0,
    stats?.checkoutClicks ?? 0,
    stats?.dailyActiveUsers ?? 0,
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{bot.name}</h1>
        <StatusBadge status={bot.status} />
      </div>

      <div className="flex flex-wrap gap-2 ">
        <Button variant="outline" size="sm" render={<Link to={`/manager/${botId}/messages`} />}>
          <Send className="mr-2 size-4" /> Messages
        </Button>
        <Button variant="outline" size="sm" render={<Link to={`/manager/${botId}/transactions`} />}>
          <ArrowLeftRight className="mr-2 size-4" /> Transactions
        </Button>
        <Button variant="outline" size="sm" render={<Link to={`/manager/${botId}/interactions`} />}>
          <MessageCircle className="mr-2 size-4" /> Interactions
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statStyles.map(({ icon: Icon, label, color }, i) => (
          <Card key={label} className={`${color} transition-all hover:shadow-lg hover:-translate-y-0.5`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground/60" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{values[i].toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
