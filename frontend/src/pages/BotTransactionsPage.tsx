import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import type { Paginated, Transaction } from "@/types";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useCallback } from "react";

function txnStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "approved" || s === "paid")
    return <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[11px]">{status}</Badge>;
  if (s === "pending" || s === "processing")
    return <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px]">{status}</Badge>;
  if (s === "failed" || s === "refunded" || s === "cancelled")
    return <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400 text-[11px]">{status}</Badge>;
  return <Badge variant="secondary" className="text-[11px]">{status}</Badge>;
}

export default function BotTransactionsPage() {
  const { botId } = useParams<{ botId: string }>();
  const [data, setData] = useState<Paginated<Transaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.transactions(botId, page);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [botId, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Payment history for this bot</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full animate-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <Receipt className="size-8 text-destructive/40" />
          </div>
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={fetchData}>Retry</Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Receipt className="size-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground">No transactions found for this bot.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                  <TableHead className="text-xs font-medium">Date</TableHead>
                  <TableHead className="text-xs font-medium">User</TableHead>
                  <TableHead className="text-xs font-medium">Amount</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium">Payment</TableHead>
                  <TableHead className="text-xs font-medium">PIX Code</TableHead>
                  <TableHead className="text-xs font-medium">Checkout</TableHead>
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
                      {item.user.username ?? item.user.telegramId}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">
                      R$ {item.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>{txnStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.paymentMethod || "—"}
                    </TableCell>
                    <TableCell>
                      {item.pixCode ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="cursor-help font-mono text-xs text-muted-foreground">
                                {item.pixCode.slice(0, 12)}…
                              </span>
                            }
                          />
                          <TooltipContent className="max-w-xs break-all font-mono text-xs">
                            {item.pixCode}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.checkoutUrl ? (
                        <a
                          href={item.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          Open <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
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
