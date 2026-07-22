import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { api, type RemarketingStatusResponse, type RemarketingStateItem } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Download,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 30_000;
const TICK_INTERVAL_MS = 1_000;

type StatusFilter = "all" | "active" | "cancelled";

function formatRelative(ms: number): string {
  if (ms <= 0) return "now";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ${hr % 24}h`;
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

function formatAbsolute(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeProgress(
  nextSendAt: string | null,
  intervalMs: number,
  now: number
): { progress: number; remainingMs: number } {
  if (!nextSendAt || intervalMs <= 0) {
    return { progress: 0, remainingMs: 0 };
  }
  const next = new Date(nextSendAt).getTime();
  const lastSend = next - intervalMs;
  const elapsed = now - lastSend;
  const progress = Math.max(0, Math.min(100, (elapsed / intervalMs) * 100));
  const remainingMs = Math.max(0, next - now);
  return { progress, remainingMs };
}

function progressColor(progress: number): string {
  if (progress >= 100) return "bg-red-500";
  if (progress >= 75) return "bg-amber-400";
  return "bg-emerald-500";
}

export default function BotRemarketingStatusPage() {
  const { botId } = useParams<{ botId: string }>();
  const { bot, loading: botLoading } = useBotDetail(botId);
  const [data, setData] = useState<RemarketingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [togglingUsers, setTogglingUsers] = useState<Set<string>>(new Set());
  const browserOffsetRef = useRef(0);
  const [now, setNow] = useState(Date.now());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const config = data?.config;
  const intervalMs = config?.intervalMs ?? 86_400_000;

  const fetchData = useCallback(async (currentPage: number, filter: StatusFilter) => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.remarketingStates(
        botId,
        currentPage,
        filter === "all" ? undefined : filter
      );
      setData(result);
      const serverMs = new Date(result.serverTime).getTime();
      browserOffsetRef.current = Date.now() - serverMs;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load remarketing states");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchData(page, statusFilter);
  }, [fetchData, page, statusFilter]);

  useEffect(() => {
    pollTimer.current = setInterval(() => {
      fetchData(page, statusFilter);
    }, POLL_INTERVAL_MS);
    tickTimer.current = setInterval(() => {
      setNow(Date.now() - browserOffsetRef.current);
    }, TICK_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (tickTimer.current) clearInterval(tickTimer.current);
    };
  }, [fetchData, page, statusFilter]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  const handleToggle = async (userId: string, currentActive: boolean) => {
    if (!botId) return;
    setTogglingUsers((prev) => new Set(prev).add(userId));
    const newActive = !currentActive;
    try {
      await api.toggleRemarketing(botId, userId, newActive);
      toast.success(newActive ? "Remarketing activated" : "Remarketing cancelled");
      fetchData(page, statusFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle remarketing");
    } finally {
      setTogglingUsers((prev) => {
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
      toast.success(
        `${result.count} remarketing schedule${result.count !== 1 ? "s" : ""} cancelled`
      );
      setCancelDialogOpen(false);
      setPage(1);
      fetchData(1, statusFilter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel remarketing");
    }
  };

  const handleExport = async () => {
    if (!botId) return;
    try {
      await api.exportRemarketingStates(botId);
      toast.success("CSV exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export");
    }
  };

  const remarketingEnabled = bot?.remarketing?.enabled;
  const activeCount = data?.items.filter((item) => item.nextSendAt !== null).length ?? 0;

  // Compute summary stats from the full dataset (not just current page)
  const totalWithProgress = data?.items
    .filter((item) => item.nextSendAt !== null)
    .map((item) => computeProgress(item.nextSendAt, intervalMs, now))
    ?? [];
  const avgProgress =
    totalWithProgress.length > 0
      ? totalWithProgress.reduce((a, b) => a + b.progress, 0) / totalWithProgress.length
      : 0;

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Timer className="size-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Remarketing Status</h1>
            <p className="text-sm text-muted-foreground">
              Follow-up delivery status{bot ? ` for ${bot.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!data || activeCount === 0}
            onClick={() => setCancelDialogOpen(true)}
          >
            <Trash2 className="size-4" />
            Cancel All ({activeCount})
          </Button>
        </div>
      </div>

      {/* Disabled warning */}
      {!remarketingEnabled && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="size-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                Remarketing is currently disabled
              </p>
              <p className="text-xs text-amber-400/70">
                Enable it in Remarketing Settings to start sending follow-up messages.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      {data && config && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="text-2xl font-bold tabular-nums">{data.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">
                {activeCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Cancelled</p>
              <p className="text-2xl font-bold tabular-nums text-muted-foreground">
                {data.total - activeCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Avg Progress</p>
              <p className="text-2xl font-bold tabular-nums">
                {Math.round(avgProgress)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <Tabs value={statusFilter} onValueChange={handleStatusFilterChange}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
          {data && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {data.total} total &middot; page {data.page} of {totalPages || 1}
            </p>
          )}
        </div>
      </Tabs>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel all remarketing?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop all {activeCount} remarketing schedule
              {activeCount !== 1 ? "s" : ""}? This will cancel all pending follow-up
              messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAll}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Empty state */}
      {!loading && !error && data && data.items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <Timer className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {statusFilter === "active"
                ? "No active remarketing schedules."
                : statusFilter === "cancelled"
                  ? "No cancelled schedules."
                  : "No remarketing states yet. Users will appear here after they interact with the bot."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Message
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Sent
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Next Send
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Last Sent
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                        Toggle
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((item) => (
                      <RemarketingRow
                        key={item.id}
                        item={item}
                        botId={botId ?? ""}
                        config={config}
                        intervalMs={intervalMs}
                        now={now}
                        isToggling={togglingUsers.has(item.userId)}
                        onToggle={handleToggle}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {data.page} of {totalPages} &middot; {data.total} result
              {data.total !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
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

function RemarketingRow({
  item,
  botId,
  config,
  intervalMs,
  now,
  isToggling,
  onToggle,
}: {
  item: RemarketingStateItem;
  botId: string;
  config: RemarketingStatusResponse["config"] | null | undefined;
  intervalMs: number;
  now: number;
  isToggling: boolean;
  onToggle: (userId: string, currentActive: boolean) => void;
}) {
  const isActive = item.nextSendAt !== null;
  const { progress, remainingMs } = computeProgress(item.nextSendAt, intervalMs, now);
  const barColor = isActive ? progressColor(progress) : "bg-muted";

  const userLabel = item.user.username
    ? `@${item.user.username}`
    : item.user.telegramId;
  const userSub =
    item.user.firstName ??
    (item.user.username ? item.user.telegramId : null);

  const maxSends = config?.maxSends ?? 0;
  const sentLabel = maxSends > 0 ? `${item.totalSent} / ${maxSends}` : String(item.totalSent);

  const messageCount = config?.messageCount ?? 0;
  const cycle = messageCount > 0 ? Math.floor(item.totalSent / messageCount) + 1 : 1;
  const nextMsgTitle =
    config && messageCount > 0
      ? config.messageTitles[item.nextIndex % messageCount] ?? "—"
      : "—";

  const discountActive =
    config?.discountOffer?.enabled &&
    config.discountOffer.tiers.some((t) => item.totalSent >= t.afterMessages);
  const discountPct =
    config?.discountOffer?.tiers
      ?.filter((t) => item.totalSent >= t.afterMessages)
      .sort((a, b) => b.afterMessages - a.afterMessages)[0]?.percentage ?? 0;

  const lastSendAt = item.nextSendAt
    ? new Date(new Date(item.nextSendAt).getTime() - intervalMs)
    : null;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Link
            to={`/manager/${botId}/interactions?userId=${item.userId}`}
            className="text-sm font-medium hover:underline inline-flex items-center gap-1"
          >
            {userLabel}
            <MessageSquare className="size-3 text-muted-foreground" />
          </Link>
          {userSub && (
            <span className="text-xs text-muted-foreground">{userSub}</span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={
            isActive
              ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
              : ""
          }
        >
          {isActive ? "Active" : "Cancelled"}
        </Badge>
      </td>

      {/* Message */}
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm">{nextMsgTitle}</span>
          {messageCount > 1 && (
            <span className="text-xs text-muted-foreground">
              Cycle {cycle} &middot; #{item.nextIndex + 1} of {messageCount}
            </span>
          )}
        </div>
      </td>

      {/* Sent */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm tabular-nums">{sentLabel}</span>
          {discountActive && discountPct > 0 && (
            <Badge className="bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20 text-[10px] px-1.5 py-0">
              -{discountPct}%
            </Badge>
          )}
        </div>
      </td>

      {/* Next Send */}
      <td className="px-4 py-3">
        {isActive ? (
          <Tooltip>
            <TooltipTrigger>
              <div className="flex flex-col gap-1 min-w-[160px] cursor-default">
                <span className="text-sm tabular-nums">
                  {remainingMs <= 0
                    ? "Overdue"
                    : `in ${formatRelative(remainingMs)}`}
                </span>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{formatAbsolute(item.nextSendAt!)}</p>
              {progress >= 100 && (
                <p className="text-xs text-amber-400 mt-0.5">
                  Overdue — waiting for scheduler tick
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Last Sent */}
      <td className="px-4 py-3">
        {lastSendAt ? (
          <Tooltip>
            <TooltipTrigger>
              <span className="text-sm text-muted-foreground tabular-nums cursor-default">
                {formatRelative(now - lastSendAt.getTime())} ago
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{formatAbsolute(lastSendAt.toISOString())}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>

      {/* Toggle */}
      <td className="px-4 py-3 text-right">
        <Switch
          checked={isActive}
          disabled={isToggling}
          onCheckedChange={() => onToggle(item.userId, isActive)}
        />
      </td>
    </tr>
  );
}
