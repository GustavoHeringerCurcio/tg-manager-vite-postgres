import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MessageFlowEditor from "./MessageFlowEditor";
import type { RemarketingConfig } from "@/types";
import { Timer } from "lucide-react";

interface RemarketingEditorProps {
  config: RemarketingConfig;
  onChange: (config: RemarketingConfig) => void;
}

const intervalUnits: { value: number; label: string }[] = [
  { value: 1, label: "Seconds" },
  { value: 60, label: "Minutes" },
  { value: 3600, label: "Hours" },
  { value: 86400, label: "Days" },
];

function bestUnit(ms: number): number {
  if (ms === 0) return 1;
  if (ms >= 86400 * 1000 && ms % (86400 * 1000) === 0) return 86400;
  if (ms >= 3600 * 1000 && ms % (3600 * 1000) === 0) return 3600;
  if (ms >= 60 * 1000 && ms % (60 * 1000) === 0) return 60;
  return 1;
}

function secondsPerUnit(unit: number): number {
  const found = intervalUnits.find((u) => u.value === unit);
  return found ? found.value : 1;
}

export default function RemarketingEditor({ config, onChange }: RemarketingEditorProps) {
  const [intervalUnit, setIntervalUnit] = useState(() => bestUnit(config.intervalMs));
  const [initialDelayUnit, setInitialDelayUnit] = useState(() => bestUnit(config.initialDelayMs));
  const unitSwitchRef = useRef<"interval" | "delay" | null>(null);

  useEffect(() => {
    if (unitSwitchRef.current === "interval") {
      unitSwitchRef.current = null;
      return;
    }
    setIntervalUnit(bestUnit(config.intervalMs));
  }, [config.intervalMs]);

  useEffect(() => {
    if (unitSwitchRef.current === "delay") {
      unitSwitchRef.current = null;
      return;
    }
    setInitialDelayUnit(bestUnit(config.initialDelayMs));
  }, [config.initialDelayMs]);

  function update(fields: Partial<RemarketingConfig>) {
    onChange({ ...config, ...fields });
  }

  function toDisplayValue(ms: number, unit: number): number {
    return ms / 1000 / secondsPerUnit(unit);
  }

  function fromDisplayValue(displayVal: number, unit: number): number {
    return displayVal * secondsPerUnit(unit) * 1000;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 mt-0.5">
            <Timer className="size-4 text-amber-400" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Remarketing</Label>
            <p className="text-xs text-muted-foreground">
              Send follow-up messages automatically after initial interaction
            </p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => update({ enabled: v })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs">Interval</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={Math.max(1, Math.round(toDisplayValue(config.intervalMs, intervalUnit)))}
                  onChange={(e) => {
                    const displayVal = Number(e.target.value);
                    if (Number.isFinite(displayVal) && displayVal >= 1) {
                      update({ intervalMs: Math.round(fromDisplayValue(displayVal, intervalUnit)) });
                    }
                  }}
                  className="h-8 text-sm"
                />
                <Select
                  value={String(intervalUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    unitSwitchRef.current = "interval";
                    setIntervalUnit(unit);
                    const seconds = config.intervalMs / 1000;
                    update({ intervalMs: Math.max(1, Math.round(seconds / secondsPerUnit(unit))) * secondsPerUnit(unit) * 1000 });
                  }}
                >
                  <SelectTrigger className="h-8 w-28 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intervalUnits.map((u) => (
                      <SelectItem key={u.value} value={String(u.value)}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Initial Delay</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={Math.round(toDisplayValue(config.initialDelayMs, initialDelayUnit))}
                  onChange={(e) => {
                    const displayVal = Number(e.target.value);
                    if (Number.isFinite(displayVal) && displayVal >= 0) {
                      update({ initialDelayMs: Math.round(fromDisplayValue(displayVal, initialDelayUnit)) });
                    }
                  }}
                  className="h-8 text-sm"
                />
                <Select
                  value={String(initialDelayUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    unitSwitchRef.current = "delay";
                    setInitialDelayUnit(unit);
                    const seconds = config.initialDelayMs / 1000;
                    update({ initialDelayMs: Math.max(0, Math.round(seconds / secondsPerUnit(unit))) * secondsPerUnit(unit) * 1000 });
                  }}
                >
                  <SelectTrigger className="h-8 w-28 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {intervalUnits.map((u) => (
                      <SelectItem key={u.value} value={String(u.value)}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Max Sends (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                value={config.maxSends}
                onChange={(e) => update({ maxSends: Number(e.target.value) })}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <MessageFlowEditor
            steps={config.messages}
            onChange={(messages) => update({ messages })}
          />
        </div>
      )}
    </div>
  );
}
