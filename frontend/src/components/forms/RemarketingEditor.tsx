import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MessageFlowEditor from "./MessageFlowEditor";
import type { RemarketingConfig, MessageStep } from "@/types";
import { newStep } from "@/lib/helpers";
import { useState } from "react";

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
  const [bulkText, setBulkText] = useState("");

  const intervalUnit = bestUnit(config.intervalMs);
  const initialDelayUnit = bestUnit(config.initialDelayMs);

  function update(fields: Partial<RemarketingConfig>) {
    onChange({ ...config, ...fields });
  }

  function handleBulkImport() {
    const lines = bulkText.split("\n").filter(Boolean);
    const messages: MessageStep[] = lines.map((line) => {
      const [url, ...captionParts] = line.split("|");
      const caption = captionParts.join("|").trim();
      const step = newStep();
      if (url.trim()) step.mediaUrls = [url.trim()];
      if (caption) step.text = caption;
      step.title = caption || "Imported message";
      return step;
    });
    update({ messages: [...config.messages, ...messages] });
    setBulkText("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Remarketing</Label>
          <p className="text-sm text-muted-foreground">
            Send follow-up messages automatically
          </p>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => update({ enabled: v })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Interval</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={Math.max(1, config.intervalMs / 1000 / intervalUnit)}
                  onChange={(e) => update({ intervalMs: Number(e.target.value) * intervalUnit * 1000 })}
                />
                <Select
                  value={String(intervalUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    const seconds = config.intervalMs / 1000;
                    update({ intervalMs: Math.max(1, Math.round(seconds / unit)) * unit * 1000 });
                  }}
                >
                  <SelectTrigger className="w-28">
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
              <Label>Initial Delay</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={config.initialDelayMs / 1000 / initialDelayUnit}
                  onChange={(e) => update({ initialDelayMs: Number(e.target.value) * initialDelayUnit * 1000 })}
                />
                <Select
                  value={String(initialDelayUnit)}
                  onValueChange={(v) => {
                    const unit = Number(v);
                    const seconds = config.initialDelayMs / 1000;
                    update({ initialDelayMs: Math.max(0, Math.round(seconds / unit)) * unit * 1000 });
                  }}
                >
                  <SelectTrigger className="w-28">
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
              <Label>Max Sends (0 = unlimited)</Label>
              <Input
                type="number"
                min={0}
                value={config.maxSends}
                onChange={(e) => update({ maxSends: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bulk Import</Label>
            <p className="text-xs text-muted-foreground">
              Paste one entry per line: <code>URL | Caption text</code>
            </p>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="https://t.me/file_id_123 | Check our new offer!"
              rows={4}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkImport}
              disabled={!bulkText.trim()}
            >
              Import
            </Button>
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
