import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { Paginated, Interaction } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Activity, Filter, ChevronLeft, ChevronRight, X } from "lucide-react";

function directionBadge(dir: string) {
  if (dir === "IN")
    return <Badge variant="outline" className="border-sky-500/30 bg-sky-500/10 text-sky-400 text-[11px]">IN</Badge>;
  if (dir === "OUT")
    return <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-400 text-[11px]">OUT</Badge>;
  return <Badge variant="secondary" className="text-[11px]">{dir}</Badge>;
}

export default function BotInteractionsPage() {
  const { botId } = useParams<{ botId: string }>();
  const [data, setData] = useState<Paginated<Interaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter);
      if (userIdFilter) params.set("userId", userIdFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const result = await api.interactions(botId, page, params);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interactions");
    } finally {
      setLoading(false);
    }
  }, [botId, page, typeFilter, userIdFilter, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const hasActiveFilters = typeFilter !== "all" || userIdFilter || fromDate || toDate;

  function handleApplyFilters() {
    setPage(1);
    fetchData();
    setFiltersOpen(false);
  }

  function handleClearFilters() {
    setTypeFilter("all");
    setUserIdFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interactions</h1>
          <p className="text-sm text-muted-foreground">User interaction logs for this bot</p>
        </div>
        <Button
          variant={filtersOpen || hasActiveFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Filter className="mr-1.5 size-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px]">!</span>
          )}
        </Button>
      </div>

      {filtersOpen && (
        <Card className="flex flex-wrap items-end gap-3 p-4 shadow-sm animate-scale-in">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Type</p>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="callback_query">Callback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">User ID</p>
            <Input
              placeholder="User ID"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">From</p>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">To</p>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="flex gap-1.5">
            <Button variant="default" size="sm" className="h-8" onClick={handleApplyFilters}>
              Apply
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon-sm" className="h-8 w-8" onClick={handleClearFilters}>
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full animate-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <Activity className="size-8 text-destructive/40" />
          </div>
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchData}>Retry</Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Activity className="size-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground">No interactions found.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                  <TableHead className="text-xs font-medium">Date</TableHead>
                  <TableHead className="text-xs font-medium">User</TableHead>
                  <TableHead className="text-xs font-medium">Type</TableHead>
                  <TableHead className="text-xs font-medium">Direction</TableHead>
                  <TableHead className="text-xs font-medium">Content</TableHead>
                  <TableHead className="text-xs font-medium w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-muted/30 transition-colors border-b border-border/30"
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {item.user?.username ?? item.user?.telegramId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">{item.type}</Badge>
                    </TableCell>
                    <TableCell>{directionBadge(item.direction)}</TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                      {item.content || "—"}
                    </TableCell>
                    <TableCell>
                      {item.payload && (
                        <Sheet>
                          <SheetTrigger
                            render={
                              <Button variant="ghost" size="icon-xs">
                                <ChevronRight className="size-3.5" />
                              </Button>
                            }
                          />
                          <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                            <SheetHeader>
                              <SheetTitle>Interaction Payload</SheetTitle>
                            </SheetHeader>
                            <pre className="mt-4 overflow-auto rounded-lg bg-muted p-4 text-xs scrollbar-thin">
                              {JSON.stringify(item.payload, null, 2)}
                            </pre>
                          </SheetContent>
                        </Sheet>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} &middot; {data?.total ?? 0} results
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
