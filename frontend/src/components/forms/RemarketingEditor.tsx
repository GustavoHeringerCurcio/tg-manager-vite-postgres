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
  { value: 60, label: "Minutes" },
  { value: 3600, label: "Hours" },
  { value: 86400, label: "Days" },
];

function bestUnit(ms: number): number {
  if (ms === 0) return 60;
  if (ms >= 86400 * 1000 && ms % (86400 * 1000) === 0) return 86400;
  if (ms >= 3600 * 1000 && ms % (3600 * 1000) === 0) return 3600;
  return 60;
}

function deriveDisplay(ms: number) {
  const unit = bestUnit(ms);
  const number = Math.round(ms / 1000 / unit);
  return { number, unit };
}

function toMs(number: number, unit: number): number {
  return number * unit * 1000;
}

export default function RemarketingEditor({ config, onChange }: RemarketingEditorProps) {
  const [intervalNumber, setIntervalNumber] = useState(() => deriveDisplay(config.intervalMs).number);
  const [intervalUnit, setIntervalUnit] = useState(() => deriveDisplay(config.intervalMs).unit);
  const [delayNumber, setDelayNumber] = useState(() => deriveDisplay(config.initialDelayMs).number);
  const [delayUnit, setDelayUnit] = useState(() => deriveDisplay(config.initialDelayMs).unit);

  const selfUpdateRef = useRef(false);

  useEffect(() => {
    if (selfUpdateRef.current) {
      selfUpdateRef.current = false;
      return;
    }
    const di = deriveDisplay(config.intervalMs);
    setIntervalNumber(di.number);
    setIntervalUnit(di.unit);
    const dd = deriveDisplay(config.initialDelayMs);
    setDelayNumber(dd.number);
    setDelayUnit(dd.unit);
  }, [config.intervalMs, config.initialDelayMs]);

  function update(fields: Partial<RemarketingConfig>) {
    selfUpdateRef.current = true;
    onChange({ ...config, ...fields });
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
                  value={intervalNumber}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n < 1) return;
                    setIntervalNumber(n);
                    update({ intervalMs: toMs(n, intervalUnit) });
                  }}
                  className="h-8 text-sm"
                />
                <Select
                  value={String(intervalUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    setIntervalUnit(unit);
                    update({ intervalMs: toMs(intervalNumber, unit) });
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
                  value={delayNumber}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n < 0) return;
                    setDelayNumber(n);
                    update({ initialDelayMs: toMs(n, delayUnit) });
                  }}
                  className="h-8 text-sm"
                />
                <Select
                  value={String(delayUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    setDelayUnit(unit);
                    update({ initialDelayMs: toMs(delayNumber, unit) });
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
