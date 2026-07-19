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
import { Upload, Download, AlertTriangle, Check, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { MessageStep } from "@/types";
import {
  parseCsvFile,
  parseLivePixResponsesCsv,
  applyLivePixResponses,
  exportLivePixResponsesCsv,
  downloadCsv,
} from "@/lib/csv";

interface LivePixResponsesCsvDialogProps {
  steps: MessageStep[];
  onImport: (updatedSteps: MessageStep[]) => void;
  botName?: string;
  filenamePrefix?: string;
}

export default function LivePixResponsesCsvDialog({
  steps,
  onImport,
  botName = "main",
  filenamePrefix = "livepix_responses",
}: LivePixResponsesCsvDialogProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    rows: ReturnType<typeof parseLivePixResponsesCsv>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const livePixButtonCount = steps.reduce(
    (sum, s) =>
      sum +
      s.buttons.filter((b) => b.action === "LIVEPIX_PAYMENT").length,
    0,
  );

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseCsvFile(file);
      const rows = parseLivePixResponsesCsv(result.data);
      if (rows.length === 0) {
        toast.error("No response rows found in CSV");
        return;
      }
      setPreviewData({ rows });
      setPreviewOpen(true);
    } catch {
      toast.error("Failed to parse CSV file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleApply() {
    if (!previewData) return;
    const { steps: updatedSteps, errors } = applyLivePixResponses(
      steps,
      previewData.rows,
    );
    if (errors.length > 0) {
      const uniqueErrors = [...new Set(errors.map((e) => e.message))];
      toast.error(`Some references not found: ${uniqueErrors.join(", ")}`);
    }
    const validRows = previewData.rows.filter((r) => r.errors.length === 0);
    onImport(updatedSteps);
    toast.success(
      `Applied ${validRows.length} response${validRows.length !== 1 ? "s" : ""} to LivePix buttons`,
    );
    setPreviewOpen(false);
    setPreviewData(null);
  }

  function handleExport() {
    const csv = exportLivePixResponsesCsv(steps);
    if (!csv) {
      toast.error("No LivePix responses configured");
      return;
    }
    const slug = botName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    downloadCsv(`${filenamePrefix}_${slug || "bot"}.csv`, csv);
    toast.success("LivePix responses exported");
  }

  const validRows = previewData?.rows.filter((r) => r.errors.length === 0) ?? [];
  const errorRows = previewData?.rows.filter((r) => r.errors.length > 0) ?? [];

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
        disabled={livePixButtonCount === 0}
        title={
          livePixButtonCount === 0
            ? "No LivePix payment buttons in the current flow"
            : "Import LivePix response messages"
        }
      >
        <Upload className="mr-1 size-3" /> Import Responses
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={handleExport}
        title="Export LivePix response messages"
      >
        <Download className="mr-1 size-3" /> Export Responses
      </Button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Review LivePix Response Import</DialogTitle>
            <DialogDescription>
              {validRows.length} response{validRows.length !== 1 ? "s" : ""} will be
              applied to LivePix buttons
              {errorRows.length > 0 && (
                <span className="text-amber-400">
                  {" "}({errorRows.length} issue{errorRows.length !== 1 ? "s" : ""})
                </span>
              )}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-auto space-y-1.5 scrollbar-thin py-1">
            {/* Group by step_id + button_label for display */}
            {(() => {
              if (!previewData) return null;
              const groups = new Map<string, ReturnType<typeof parseLivePixResponsesCsv>>();
              previewData.rows.forEach((r) => {
                const key = `${r.step_id}|${r.button_label}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(r);
              });

              return [...groups.entries()].map(([key, rows]) => {
                const [stepId, buttonLabel] = key.split("|");
                const hasErrors = rows.some((r) => r.errors.length > 0);

                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-lg border p-3 space-y-1.5",
                      hasErrors
                        ? "border-destructive/20 bg-destructive/5"
                        : "border-border/50 bg-muted/20",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {hasErrors ? (
                        <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                      ) : (
                        <Check className="size-3.5 text-emerald-400 shrink-0" />
                      )}
                      <span className="text-sm font-medium">{stepId}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-500/20 bg-amber-500/10 text-amber-400 gap-1"
                      >
                        <CreditCard className="size-2.5" />
                        {buttonLabel}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {rows.length} response{rows.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {rows
                      .filter((r) => r.errors.length > 0)
                      .map((r, i) => (
                        <div key={i} className="pl-6 space-y-0.5">
                          {r.errors.map((err, j) => (
                            <p
                              key={j}
                              className="text-[10px] text-destructive"
                            >
                              {err.field}: {err.message}
                            </p>
                          ))}
                        </div>
                      ))}

                    {rows.filter((r) => r.errors.length === 0).map((r, i) => (
                      <div key={i} className="pl-6">
                        <p className="text-[10px] text-muted-foreground truncate">
                          {r.text || r.image_url || r.video_url || r.audio_url || "(empty response)"}
                          {r.include_qr_code.toLowerCase() === "true" && " +QR"}
                          {r.include_pix_code.toLowerCase() === "true" && " +PIX"}
                          {r.include_checkout_url.toLowerCase() === "true" && " +URL"}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              });
            })()}

            {!previewData?.rows.length && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No response rows found in CSV
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreviewOpen(false);
                setPreviewData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={validRows.length === 0}
            >
              Apply {validRows.length} Response{validRows.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
