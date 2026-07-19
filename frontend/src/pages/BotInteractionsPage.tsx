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

function directionBadge(dir: string) {
  if (dir === "IN") return <Badge variant="outline" className="border-sky-500/30 bg-sky-500/15 text-sky-400 text-xs">IN</Badge>;
  if (dir === "OUT") return <Badge variant="outline" className="border-violet-500/30 bg-violet-500/15 text-violet-400 text-xs">OUT</Badge>;
  return <Badge variant="secondary" className="text-xs">{dir}</Badge>;
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

  function handleApplyFilters() {
    setPage(1);
    fetchData();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Interactions</h1>
        <p className="text-muted-foreground">User interaction logs for this bot</p>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-4 shadow-card">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Type</p>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
            <SelectTrigger className="w-36">
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
          <p className="text-xs text-muted-foreground">User ID</p>
          <Input
            placeholder="User ID"
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">From</p>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">To</p>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button variant="default" size="sm" onClick={handleApplyFilters}>
          Apply Filters
        </Button>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchData}>Retry</Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-muted-foreground">No interactions found.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs">{new Date(item.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{item.user?.username ?? item.user?.telegramId ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                    </TableCell>
                    <TableCell>{directionBadge(item.direction)}</TableCell>
                    <TableCell className="max-w-40 truncate text-xs">{item.content || "—"}</TableCell>
                    <TableCell>
                      {item.payload && (
                        <Sheet>
                          <SheetTrigger render={<Button variant="ghost" size="icon-xs">…</Button>} />
                          <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                            <SheetHeader>
                              <SheetTitle>Interaction Payload</SheetTitle>
                            </SheetHeader>
                            <pre className="mt-4 overflow-auto rounded-md bg-muted p-4 text-xs">
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
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
