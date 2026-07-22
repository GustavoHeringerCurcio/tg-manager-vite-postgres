import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, RefreshCw } from "lucide-react";
import type { DashboardPeriod, Granularity } from "@/lib/api";

type TimePreset = "7d" | "30d" | "month" | "year" | "all" | "custom";

interface PeriodFilterProps {
  value: DashboardPeriod;
  autoRefresh: boolean;
  onPeriodChange: (period: DashboardPeriod) => void;
  onAutoRefreshChange: (enabled: boolean) => void;
}

function presetToPeriod(preset: TimePreset, granularity: Granularity): DashboardPeriod {
  const now = new Date();
  const to = now.toISOString();

  switch (preset) {
    case "7d":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to, granularity };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to, granularity };
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to, granularity };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: start.toISOString(), to, granularity };
    }
    case "all":
      return { from: "2020-01-01T00:00:00.000Z", granularity };
    case "custom":
      return { granularity };
  }
}

function detectPreset(period: DashboardPeriod): TimePreset {
  if (!period.from && !period.to) return "all";

  const now = new Date();
  const fromDate = period.from ? new Date(period.from) : null;
  const toDate = period.to ? new Date(period.to) : null;

  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (toDate && Math.abs(toDate.getTime() - todayEnd.getTime()) < 3600000) {
    if (fromDate) {
      const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      days7.setHours(0, 0, 0, 0);
      if (Math.abs(fromDate.getTime() - days7.getTime()) < 3600000) return "7d";

      const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      days30.setHours(0, 0, 0, 0);
      if (Math.abs(fromDate.getTime() - days30.getTime()) < 3600000) return "30d";

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      if (Math.abs(fromDate.getTime() - monthStart.getTime()) < 3600000) return "month";

      const yearStart = new Date(now.getFullYear(), 0, 1);
      if (Math.abs(fromDate.getTime() - yearStart.getTime()) < 3600000) return "year";
    }
  }

  return "custom";
}

const presets: { key: TimePreset; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export default function PeriodFilter({
  value,
  autoRefresh,
  onPeriodChange,
  onAutoRefreshChange,
}: PeriodFilterProps) {
  const [activePreset, setActivePreset] = useState<TimePreset>(detectPreset(value));
  const [customFrom, setCustomFrom] = useState(value.from ? value.from.slice(0, 10) : "");
  const [customTo, setCustomTo] = useState(value.to ? value.to.slice(0, 10) : "");

  function handlePresetChange(preset: TimePreset) {
    setActivePreset(preset);
    if (preset !== "custom") {
      onPeriodChange(presetToPeriod(preset, value.granularity));
    }
  }

  function handleCustomApply() {
    const period: DashboardPeriod = {
      from: customFrom ? new Date(customFrom).toISOString() : undefined,
      to: customTo ? new Date(customTo + "T23:59:59.999Z").toISOString() : undefined,
      granularity: value.granularity,
    };
    onPeriodChange(period);
  }

  function handleGranularityChange(g: string) {
    onPeriodChange({ ...value, granularity: g as Granularity });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
        {presets.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePresetChange(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activePreset === key
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => handlePresetChange("custom")}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activePreset === "custom"
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="size-3.5 inline mr-1" />
          Custom
        </button>
      </div>

      {activePreset === "custom" && (
        <div className="flex items-center gap-1.5 animate-fade-in">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <Button size="sm" className="h-8" onClick={handleCustomApply}>
            Apply
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3 ml-auto">
        <Tabs value={value.granularity} onValueChange={handleGranularityChange}>
          <TabsList className="h-7">
            <TabsTrigger value="daily" className="text-[11px] px-2.5">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-[11px] px-2.5">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-[11px] px-2.5">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1.5">
          <Switch
            checked={autoRefresh}
            onCheckedChange={onAutoRefreshChange}
            className="scale-75"
          />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
            <RefreshCw className="size-3" />
            Auto
          </span>
        </div>
      </div>
    </div>
  );
}
