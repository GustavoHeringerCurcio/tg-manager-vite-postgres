import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Download, AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MessageStep } from "@/types";
import {
  parseCsvFile,
  parseFlowCsv,
  buildMessageSteps,
  stepsToFlowCsv,
  downloadCsv,
} from "@/lib/csv";

interface MessageFlowCsvDialogProps {
  steps: MessageStep[];
  onImport: (steps: MessageStep[], mode: "replace" | "append") => void;
  botName?: string;
  filenamePrefix?: string;
}

export default function MessageFlowCsvDialog({
  steps,
  onImport,
  botName = "main",
  filenamePrefix = "message_flow",
}: MessageFlowCsvDialogProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedSteps, setParsedSteps] = useState<ReturnType<typeof parseFlowCsv>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseCsvFile(file);
      const parsed = parseFlowCsv(result.data);
      if (parsed.length === 0) {
        toast.error("No valid steps found in CSV");
        return;
      }
      setParsedSteps(parsed);
      setPreviewOpen(true);
    } catch {
      toast.error("Failed to parse CSV file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleReplaceAll() {
    const newSteps = buildMessageSteps(parsedSteps);
    onImport(newSteps, "replace");
    toast.success(`Imported ${newSteps.length} step${newSteps.length !== 1 ? "s" : ""}`);
    setPreviewOpen(false);
    setParsedSteps([]);
  }

  function handleAppend() {
    const newSteps = buildMessageSteps(parsedSteps);
    onImport(newSteps, "append");
    toast.success(`Appended ${newSteps.length} step${newSteps.length !== 1 ? "s" : ""}`);
    setPreviewOpen(false);
    setParsedSteps([]);
  }

  function handleExport() {
    if (steps.length === 0) {
      toast.error("No steps to export");
      return;
    }
    const csv = stepsToFlowCsv(steps);
    const slug = botName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    downloadCsv(`${filenamePrefix}_${slug || "bot"}.csv`, csv);
    toast.success("Flow exported");
  }

  const totalErrors = parsedSteps.reduce(
    (sum, s) => sum + s.errors.length + s.buttonRows.reduce((bs, b) => bs + b.errors.length, 0),
    0,
  );

  const validSteps = parsedSteps.filter(
    (s) => s.errors.length === 0,
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportFile}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="mr-1 size-3" /> Import CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={handleExport}
      >
        <Download className="mr-1 size-3" /> Export CSV
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Review Import</DialogTitle>
            <DialogDescription>
              {validSteps.length} step{validSteps.length !== 1 ? "s" : ""} will be imported
              {totalErrors > 0 && (
                <span className="text-amber-400">
                  {" "}({totalErrors} issue{totalErrors !== 1 ? "s" : ""})
                </span>
              )}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-auto space-y-2 scrollbar-thin py-1">
            {parsedSteps.map((step, i) => {
              const hasStepErrors = step.errors.length > 0;
              const hasButtonErrors = step.buttonRows.some((b) => b.errors.length > 0);
              const isInvalid = hasStepErrors || hasButtonErrors;

              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-3 space-y-2",
                    isInvalid
                      ? "border-destructive/20 bg-destructive/5"
                      : "border-border/50 bg-muted/20",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isInvalid ? (
                      <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                    ) : (
                      <Check className="size-3.5 text-emerald-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium">{step.title || step.step_id}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        step.type === "TEXT"
                          ? ""
                          : step.type === "VIDEO"
                            ? "border-violet-500/20 bg-violet-500/10 text-violet-400"
                            : step.type === "IMAGE"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/20 bg-amber-500/10 text-amber-400",
                      )}
                    >
                      {step.type || "?"}
                    </Badge>
                    {step.buttonRows.length > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {step.buttonRows.length} btn{step.buttonRows.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {step.errors.length > 0 && (
                    <div className="space-y-0.5">
                      {step.errors.map((err, j) => (
                        <p
                          key={j}
                          className="text-[10px] text-destructive pl-6"
                        >
                          {err.field}: {err.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {step.buttonRows.filter((b) => b.errors.length > 0).map((btn, j) => (
                    <div key={j} className="pl-6 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">
                        Button &quot;{btn.label}&quot;:
                      </p>
                      {btn.errors.map((err, k) => (
                        <p key={k} className="text-[10px] text-destructive pl-2">
                          {err.field}: {err.message}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewOpen(false);
                setParsedSteps([]);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAppend}
              disabled={validSteps.length === 0}
            >
              Append
            </Button>
            <Button
              size="sm"
              onClick={handleReplaceAll}
              disabled={validSteps.length === 0}
            >
              Replace All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
