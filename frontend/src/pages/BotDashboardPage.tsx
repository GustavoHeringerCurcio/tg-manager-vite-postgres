import { useParams, Link } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Activity, Send, MousePointerClick, CreditCard, UserCheck, MessageCircle, ArrowLeftRight } from "lucide-react";

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

  const statCards = [
    { icon: Users, label: "Total Users", value: stats?.totalUsers ?? 0 },
    { icon: Activity, label: "Total Interactions", value: stats?.totalInteractions ?? 0 },
    { icon: Send, label: "Messages Sent", value: stats?.messageCount ?? 0 },
    { icon: MousePointerClick, label: "Callbacks", value: stats?.callbackCount ?? 0 },
    { icon: CreditCard, label: "Checkout Clicks", value: stats?.checkoutClicks ?? 0 },
    { icon: UserCheck, label: "Daily Active Users", value: stats?.dailyActiveUsers ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{bot.name}</h1>
        <StatusBadge status={bot.status} />
      </div>

      <div className="flex flex-wrap gap-2">
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
        {statCards.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-primary/60" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
