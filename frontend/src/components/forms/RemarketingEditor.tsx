import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MessageFlowEditor from "./MessageFlowEditor";
import MessageFlowCsvDialog from "./MessageFlowCsvDialog";
import type { RemarketingConfig } from "@/types";
import { Timer, Upload } from "lucide-react";

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

export default function RemarketingEditor({ config, onChange }: RemarketingEditorProps) {
  const intervalUnit = bestUnit(config.intervalMs);
  const initialDelayUnit = bestUnit(config.initialDelayMs);

  function update(fields: Partial<RemarketingConfig>) {
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
                  value={Math.max(1, config.intervalMs / 1000 / intervalUnit)}
                  onChange={(e) => update({ intervalMs: Number(e.target.value) * intervalUnit * 1000 })}
                  className="h-8 text-sm"
                />
                <Select
                  value={String(intervalUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    const seconds = config.intervalMs / 1000;
                    update({ intervalMs: Math.max(1, Math.round(seconds / unit)) * unit * 1000 });
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
                  value={config.initialDelayMs / 1000 / initialDelayUnit}
                  onChange={(e) => update({ initialDelayMs: Number(e.target.value) * initialDelayUnit * 1000 })}
                  className="h-8 text-sm"
                />
                <Select
                  value={String(initialDelayUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    const seconds = config.initialDelayMs / 1000;
                    update({ initialDelayMs: Math.max(0, Math.round(seconds / unit)) * unit * 1000 });
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

          <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
            <Label className="text-xs flex items-center gap-1.5">
              <Upload className="size-3" />
              Bulk Import
            </Label>
            <p className="text-xs text-muted-foreground">
              Import or export your remarketing flow via CSV.
            </p>
            <MessageFlowCsvDialog
              steps={config.messages}
              onImport={(newMessages, mode) => {
                if (mode === "replace") {
                  update({ messages: newMessages });
                } else {
                  update({ messages: [...config.messages, ...newMessages] });
                }
              }}
              botName="remarketing"
              filenamePrefix="remarketing_flow"
            />
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
