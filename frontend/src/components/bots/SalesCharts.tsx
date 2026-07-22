import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DashboardStatsResponse } from "@/lib/api";

interface SalesChartsProps {
  timeline: DashboardStatsResponse["timeline"];
}

const revenueConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-2))",
  },
  transactions: {
    label: "Orders",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const engagementConfig = {
  interactions: {
    label: "Interactions",
    color: "hsl(var(--chart-1))",
  },
  newUsers: {
    label: "New Users",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function SalesCharts({ timeline }: SalesChartsProps) {
  const hasData = timeline.length > 0;

  const { totalRevenue, totalOrders, totalInteractions, totalNewUsers } = useMemo(() => {
    let revenue = 0;
    let orders = 0;
    let interactions = 0;
    let newUsers = 0;
    for (const point of timeline) {
      revenue += point.revenue;
      orders += point.transactions;
      interactions += point.interactions;
      newUsers += point.newUsers;
    }
    return { totalRevenue: revenue, totalOrders: orders, totalInteractions: interactions, totalNewUsers: newUsers };
  }, [timeline]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-3">
          <svg className="size-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <p className="text-sm">No data for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-card/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Revenue & Orders</h3>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-muted-foreground">
                Total: <span className="font-medium text-foreground">{formatCurrency(totalRevenue)}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                Orders: <span className="font-medium text-foreground">{totalOrders.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>
        <ChartContainer config={revenueConfig} className="h-72 w-full">
          <ComposedChart data={timeline} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => `R$${v}`}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const date = payload?.[0]?.payload?.date;
                    return date ? formatDate(date) : "";
                  }}
                  formatter={(value, name) => {
                    if (name === "revenue") return <span className="font-mono">{formatCurrency(value as number)}</span>;
                    return <span className="font-mono">{(value as number).toLocaleString()}</span>;
                  }}
                />
              }
            />
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              yAxisId="left"
              dataKey="revenue"
              fill="url(#revenueGradient)"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              type="monotone"
              name="revenue"
            />
            <Bar
              yAxisId="right"
              dataKey="transactions"
              fill="hsl(var(--chart-1))"
              radius={[4, 4, 0, 0]}
              name="transactions"
              fillOpacity={0.7}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </ComposedChart>
        </ChartContainer>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden shadow-sm bg-card/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Users & Engagement</h3>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-muted-foreground">
                Interactions: <span className="font-medium text-foreground">{totalInteractions.toLocaleString()}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                New Users: <span className="font-medium text-foreground">{totalNewUsers.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>
        <ChartContainer config={engagementConfig} className="h-72 w-full">
          <LineChart data={timeline} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatDate}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const date = payload?.[0]?.payload?.date;
                    return date ? formatDate(date) : "";
                  }}
                  formatter={(value, name) => {
                    return <span className="font-mono">{(value as number).toLocaleString()}</span>;
                  }}
                />
              }
            />
            <Line
              dataKey="interactions"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={false}
              type="monotone"
              name="interactions"
            />
            <Line
              dataKey="newUsers"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
              dot={false}
              type="monotone"
              name="newUsers"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
      </div>
    </div>
  );
}
