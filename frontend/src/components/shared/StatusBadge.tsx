import { Badge } from "@/components/ui/badge";
import type { BotStatus } from "@/types";

const statusConfig: Record<BotStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  INACTIVE: {
    label: "Inactive",
    className: "border-border bg-muted text-muted-foreground",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function StatusBadge({ status }: { status: BotStatus }) {
  const config = statusConfig[status];

  return (
    <Badge variant="outline" className={`gap-1 text-xs ${config.className}`}>
      {status === "ACTIVE" && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
      )}
      {config.label}
    </Badge>
  );
}
