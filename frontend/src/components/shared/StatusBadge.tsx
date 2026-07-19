import { Badge } from "@/components/ui/badge";
import type { BotStatus } from "@/types";

const statusClasses: Record<BotStatus, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
  INACTIVE: "",
  SUSPENDED: "",
};

const statusVariant: Record<BotStatus, "destructive" | "secondary" | null> = {
  ACTIVE: null,
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
};

const statusLabel: Record<BotStatus, string> = {
  ACTIVE: "● Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
};

export function StatusBadge({ status }: { status: BotStatus }) {
  const variant = statusVariant[status];
  const extra = statusClasses[status];

  if (variant === null) {
    return <Badge variant="outline" className={`text-xs ${extra}`}>{statusLabel[status]}</Badge>;
  }

  return (
    <Badge variant={variant} className={`text-xs ${extra}`}>
      {statusLabel[status]}
    </Badge>
  );
}
