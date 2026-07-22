import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FormatType = "number" | "currency" | "percent";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  previousValue: number;
  changePercent: number | null;
  format?: FormatType;
  subtitle?: string;
  iconColor: string;
  gradient: string;
  ringColor: string;
}

function formatValue(value: number, format: FormatType): string {
  switch (format) {
    case "currency":
      return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "number":
    default:
      return value.toLocaleString();
  }
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  previousValue,
  changePercent,
  format = "number",
  subtitle,
  iconColor,
  gradient,
  ringColor,
}: StatCardProps) {
  return (
    <Card
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
          {formatValue(value, format)}
        </p>
        <div className="mt-1 flex items-center gap-1">
          {changePercent !== null && previousValue > 0 ? (
            <>
              {changePercent > 0 ? (
                <TrendingUp className="size-3 text-emerald-400" />
              ) : changePercent < 0 ? (
                <TrendingDown className="size-3 text-red-400" />
              ) : (
                <Minus className="size-3 text-muted-foreground" />
              )}
              <span
                className={`text-[11px] font-medium ${
                  changePercent > 0
                    ? "text-emerald-400"
                    : changePercent < 0
                    ? "text-red-400"
                    : "text-muted-foreground"
                }`}
              >
                {Math.abs(changePercent).toFixed(1)}% vs previous
              </span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">
              {subtitle ?? "all time"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
