import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { api, type Paginated, type RemarketingStateItem } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Timer,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export default function BotRemarketingStatusPage() {
  const { botId } = useParams<{ botId: string }>();
  const { bot, loading: botLoading } = useBotDetail(botId);
  const [data, setData] = useState<Paginated<RemarketingStateItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [togglingUsers, setTogglingUsers] = useState<Set<string>>(new Set());

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  const fetchData = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.remarketingStates(botId, page);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load remarketing states");
    } finally {
      setLoading(false);
    }
  }, [botId, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (userId: string, currentActive: boolean) => {
    if (!botId) return;
    setTogglingUsers(prev => new Set(prev).add(userId));
    const newActive = !currentActive;
    try {
      await api.toggleRemarketing(botId, userId, newActive);
      toast.success(newActive ? "Remarketing activated" : "Remarketing cancelled");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle remarketing");
    } finally {
      setTogglingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleCancelAll = async () => {
    if (!botId) return;
    try {
      const result = await api.cancelAllRemarketing(botId);
      toast.success(`${result.count} remarketing schedule${result.count !== 1 ? "s" : ""} cancelled`);
      setCancelDialogOpen(false);
      setPage(1);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel remarketing");
    }
  };

  const remarketingEnabled = bot?.remarketing?.enabled;
  const activeCount = data?.items.filter(item => item.nextSendAt !== null).length ?? 0;

  if (botLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <Timer className="size-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Remarketing Status</h1>
          <p className="text-sm text-muted-foreground">Follow-up delivery status{bot ? ` for ${bot.name}` : ""}</p>
        </div>
      </div>

      {!remarketingEnabled && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">Remarketing is currently disabled</p>
              <p className="text-xs text-amber-400/70">Enable it in Remarketing Settings to start sending follow-up messages.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="destructive"
          size="sm"
          disabled={!data || activeCount === 0}
          onClick={() => setCancelDialogOpen(true)}
        >
          <Trash2 className="size-4" />
          Cancel All Remarketing ({activeCount})
        </Button>
        {data && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {data.total} total · {activeCount} active
          </p>
        )}
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel all remarketing?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop all {activeCount} remarketing schedule{activeCount !== 1 ? "s" : ""}? This will cancel all pending follow-up messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAll}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <Timer className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No remarketing states yet. Users will appear here after they interact with the bot.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Videos Sent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Next Send</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Toggle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((item) => {
                      const isActive = item.nextSendAt !== null;
                      const isToggling = togglingUsers.has(item.userId);
                      const userLabel = item.user.username
                        ? `@${item.user.username}`
                        : item.user.telegramId;
                      const userSub = item.user.firstName
                        ?? (item.user.username ? item.user.telegramId : null);

                      return (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{userLabel}</span>
                              {userSub && (
                                <span className="text-xs text-muted-foreground">{userSub}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={isActive ? "default" : "secondary"}
                              className={isActive ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20" : ""}
                            >
                              {isActive ? "Active" : "Cancelled"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums">{item.totalSent}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
                            {isActive
                              ? new Date(item.nextSendAt!).toLocaleString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Switch
                              checked={isActive}
                              disabled={isToggling}
                              onCheckedChange={() => handleToggle(item.userId, isActive)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {data.page} of {totalPages} · {data.total} result{data.total !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="xs"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
