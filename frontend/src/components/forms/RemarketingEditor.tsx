import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MessageFlowEditor from "./MessageFlowEditor";
import type { RemarketingConfig, MessageStep } from "@/types";
import { newStep } from "@/lib/helpers";
import { useState, useMemo } from "react";
import { Timer, Upload, AlertTriangle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ParsedLine {
  line: number;
  url: string;
  caption: string;
  valid: boolean;
  error?: string;
}

export default function RemarketingEditor({ config, onChange }: RemarketingEditorProps) {
  const [bulkText, setBulkText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const intervalUnit = bestUnit(config.intervalMs);
  const initialDelayUnit = bestUnit(config.initialDelayMs);

  function update(fields: Partial<RemarketingConfig>) {
    onChange({ ...config, ...fields });
  }

  const parsedLines = useMemo<ParsedLine[]>(() => {
    const lines = bulkText.split("\n").filter((l) => l.trim());
    return lines.map((line, i) => {
      const trimmed = line.trim();
      const sepIndex = trimmed.indexOf("|");
      if (sepIndex === -1) {
        return { line: i + 1, url: trimmed, caption: "", valid: true };
      }
      const url = trimmed.slice(0, sepIndex).trim();
      const caption = trimmed.slice(sepIndex + 1).trim();
      if (!url) {
        return { line: i + 1, url: "", caption, valid: false, error: "Missing URL" };
      }
      return { line: i + 1, url, caption, valid: true };
    });
  }, [bulkText]);

  const validCount = parsedLines.filter((p) => p.valid).length;
  const errorCount = parsedLines.filter((p) => !p.valid).length;

  function openPreview() {
    if (!bulkText.trim()) return;
    setPreviewOpen(true);
  }

  function handleBulkImport() {
    const messages: MessageStep[] = parsedLines
      .filter((p) => p.valid)
      .map((parsed) => {
        const step = newStep();
        if (parsed.url) step.mediaUrls = [parsed.url];
        if (parsed.caption) step.text = parsed.caption;
        step.title = parsed.caption || parsed.url || "Imported message";
        return step;
      });

    update({ messages: [...config.messages, ...messages] });
    setBulkText("");
    setPreviewOpen(false);
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
              Paste one entry per line: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">URL | Caption text</code>
            </p>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="https://t.me/file_id_123 | Check our new offer!&#10;https://t.me/file_id_456 | Limited time deal"
              rows={5}
              className="text-sm font-mono"
            />
            {bulkText.trim() && (
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={openPreview}
                  className="h-7 text-xs"
                >
                  <Check className="mr-1 size-3" /> Review import ({validCount} items)
                </Button>
                {errorCount > 0 && (
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    {errorCount} invalid
                  </span>
                )}
              </div>
            )}
          </div>

          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Review Bulk Import</DialogTitle>
                <DialogDescription>
                  {validCount} message{validCount !== 1 ? "s" : ""} will be imported. Review the list below before confirming.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-64 overflow-auto space-y-1.5 scrollbar-thin py-1">
                {parsedLines.map((parsed) => (
                  <div
                    key={parsed.line}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                      parsed.valid
                        ? "bg-muted/30"
                        : "bg-destructive/5 border border-destructive/20"
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5 w-5 shrink-0">
                      #{parsed.line}
                    </span>
                    {parsed.valid ? (
                      <>
                        <Check className="size-3 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-medium">{parsed.caption || "(no caption)"}</p>
                          {parsed.url && (
                            <p className="text-[10px] text-muted-foreground truncate">{parsed.url}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <X className="size-3 text-destructive shrink-0 mt-0.5" />
                        <p className="text-destructive">{parsed.error}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleBulkImport} disabled={validCount === 0}>
                  Import {validCount} message{validCount !== 1 ? "s" : ""}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <MessageFlowEditor
            steps={config.messages}
            onChange={(messages) => update({ messages })}
          />
        </div>
      )}
    </div>
  );
}
