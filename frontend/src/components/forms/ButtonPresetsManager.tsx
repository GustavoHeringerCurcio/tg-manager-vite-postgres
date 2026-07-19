import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Upload,
  Download,
  Check,
  AlertTriangle,
  Pencil,
  X,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ButtonAction, ButtonColor } from "@/types";
import { useButtonPresets, type ButtonPreset } from "@/hooks/useButtonPresets";
import {
  parseCsvFile,
  parseButtonPresetsCsv,
  presetsToCsv,
  downloadCsv,
  BUTTON_PRESET_HEADERS,
} from "@/lib/csv";

const colorSwatches: { value: ButtonColor; class: string }[] = [
  { value: "BLUE", class: "bg-blue-500" },
  { value: "GREEN", class: "bg-emerald-500" },
  { value: "RED", class: "bg-red-500" },
];

export default function ButtonPresetsManager() {
  const { presets, addPreset, updatePreset, deletePreset, importPresets } = useButtonPresets();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importData, setImportData] = useState<{
    presets: Omit<ButtonPreset, "id">[];
    errors: { row: number; field: string; message: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newName, setNewName] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState<ButtonAction>("OPEN_URL");
  const [newColor, setNewColor] = useState<ButtonColor>("BLUE");
  const [newUrl, setNewUrl] = useState("");
  const [newPrice, setNewPrice] = useState("29.90");

  const [editName, setEditName] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editAction, setEditAction] = useState<ButtonAction>("OPEN_URL");
  const [editColor, setEditColor] = useState<ButtonColor>("BLUE");
  const [editUrl, setEditUrl] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const validCount = importData?.presets.length ?? 0;
  const errorCount = importData?.errors.length ?? 0;

  function resetNewForm() {
    setNewName("");
    setNewLabel("");
    setNewAction("OPEN_URL");
    setNewColor("BLUE");
    setNewUrl("");
    setNewPrice("29.90");
  }

  function handleAdd() {
    if (!newName.trim() || !newLabel.trim()) return;
    addPreset({
      name: newName.trim(),
      label: newLabel.trim(),
      action: newAction,
      color: newColor,
      url: newAction === "OPEN_URL" ? newUrl.trim() || undefined : undefined,
      price: newAction === "LIVEPIX_PAYMENT" ? parseFloat(newPrice) || 29.9 : undefined,
    });
    resetNewForm();
    toast.success("Preset added");
  }

  function startEdit(preset: ButtonPreset) {
    setEditingId(preset.id);
    setEditName(preset.name);
    setEditLabel(preset.label);
    setEditAction(preset.action);
    setEditColor(preset.color);
    setEditUrl(preset.url ?? "");
    setEditPrice(String(preset.price ?? "29.90"));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(id: string) {
    if (!editName.trim() || !editLabel.trim()) return;
    updatePreset(id, {
      name: editName.trim(),
      label: editLabel.trim(),
      action: editAction,
      color: editColor,
      url: editAction === "OPEN_URL" ? editUrl.trim() || undefined : undefined,
      price: editAction === "LIVEPIX_PAYMENT" ? parseFloat(editPrice) || 29.9 : undefined,
    });
    setEditingId(null);
    toast.success("Preset updated");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseCsvFile(file);
      const { presets, errors } = parseButtonPresetsCsv(result.data);
      setImportData({ presets, errors });
      setImportPreviewOpen(true);
    } catch {
      toast.error("Failed to parse CSV file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function confirmImport() {
    if (!importData) return;
    const count = importPresets(importData.presets);
    toast.success(`Imported ${count} preset${count !== 1 ? "s" : ""}`);
    setImportData(null);
    setImportPreviewOpen(false);
  }

  function handleExport() {
    if (presets.length === 0) {
      toast.error("No presets to export");
      return;
    }
    const csv = presetsToCsv(presets);
    downloadCsv("button_presets.csv", csv);
    toast.success("Presets exported");
  }

  function handleExportTemplate() {
    const csv = presetsToCsv([]);
    downloadCsv("button_presets_template.csv", csv);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CreditCard className="mr-1.5 size-3.5" />
        Button Presets
      </Button>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Button Presets</DialogTitle>
          <DialogDescription>
            Manage reusable button templates for your message flows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-auto scrollbar-thin pr-1">
          {/* New preset form */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-3">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Plus className="size-3" /> New Preset
            </Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. PIX azul"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Button text"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Action</Label>
                <Select value={newAction} onValueChange={(v) => setNewAction(v as ButtonAction)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN_URL">Open URL</SelectItem>
                    <SelectItem value="LIVEPIX_PAYMENT">LivePix Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {newAction === "OPEN_URL" && (
                <div className="space-y-1">
                  <Label className="text-[10px]">URL</Label>
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-7 text-xs"
                  />
                </div>
              )}
              {newAction === "LIVEPIX_PAYMENT" && (
                <div className="space-y-1">
                  <Label className="text-[10px]">Price (R$)</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-[10px]">Color</Label>
                <div className="flex gap-1.5 pt-1">
                  {colorSwatches.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      onClick={() => setNewColor(swatch.value)}
                      className={cn(
                        "size-6 rounded-full border-2 transition-all",
                        newColor === swatch.value
                          ? "border-white ring-2 ring-offset-1 ring-offset-background scale-110"
                          : "border-transparent",
                        swatch.class,
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="h-7 text-xs">
              <Plus className="mr-1 size-3" /> Add Preset
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 size-3" /> Import CSV
            </Button>
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
              onClick={handleExport}
            >
              <Download className="mr-1 size-3" /> Export CSV
            </Button>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {presets.length} preset{presets.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Presets table */}
          {presets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">No presets saved yet</p>
              <p className="text-xs text-muted-foreground/60">
                Create a preset above or{" "}
                <button
                  onClick={handleExportTemplate}
                  className="underline hover:text-foreground"
                >
                  download a template
                </button>
                {" "}to get started with CSV import.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Label</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Color</TableHead>
                  <TableHead className="text-xs">Details</TableHead>
                  <TableHead className="text-xs w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {presets.map((preset) => {
                  const isEditing = editingId === preset.id;
                  return (
                    <TableRow key={preset.id}>
                      {isEditing ? (
                        <>
                          <TableCell>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Select value={editAction} onValueChange={(v) => setEditAction(v as ButtonAction)}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="OPEN_URL">Open URL</SelectItem>
                                <SelectItem value="LIVEPIX_PAYMENT">LivePix</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {colorSwatches.map((swatch) => (
                                <button
                                  key={swatch.value}
                                  type="button"
                                  onClick={() => setEditColor(swatch.value)}
                                  className={cn(
                                    "size-4 rounded-full border",
                                    editColor === swatch.value
                                      ? "ring-1 ring-white"
                                      : "opacity-30",
                                    swatch.class,
                                  )}
                                />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {editAction === "OPEN_URL" && (
                              <Input
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                className="h-7 text-xs"
                                placeholder="https://..."
                              />
                            )}
                            {editAction === "LIVEPIX_PAYMENT" && (
                              <Input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="h-7 text-xs"
                                placeholder="29.90"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => saveEdit(preset.id)}
                              >
                                <Check className="size-3 text-emerald-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={cancelEdit}
                              >
                                <X className="size-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-xs font-medium">{preset.name}</TableCell>
                          <TableCell className="text-xs">{preset.label}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] gap-1",
                                preset.action === "LIVEPIX_PAYMENT"
                                  ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                  : "",
                              )}
                            >
                              {preset.action === "OPEN_URL" ? (
                                <ExternalLink className="size-2.5" />
                              ) : (
                                <CreditCard className="size-2.5" />
                              )}
                              {preset.action === "LIVEPIX_PAYMENT"
                                ? `LivePix ${preset.price ? `R$${preset.price.toFixed(2)}` : ""}`
                                : "Open URL"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-block size-3 rounded-full",
                                colorSwatches.find((c) => c.value === preset.color)?.class,
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-32">
                            {preset.action === "OPEN_URL"
                              ? preset.url ?? ""
                              : preset.price
                                ? `R$ ${preset.price.toFixed(2)}`
                                : ""}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => startEdit(preset)}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  deletePreset(preset.id);
                                  toast.success("Preset deleted");
                                }}
                              >
                                <Trash2 className="size-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Import preview dialog */}
      <Dialog open={importPreviewOpen} onOpenChange={setImportPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Import</DialogTitle>
            <DialogDescription>
              {validCount} preset{validCount !== 1 ? "s" : ""} will be imported
              {errorCount > 0 && (
                <span className="text-amber-400">
                  {" "}({errorCount} error{errorCount !== 1 ? "s" : ""})
                </span>
              )}
              .
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-64 overflow-auto space-y-1.5 scrollbar-thin py-1">
            {importData?.errors.map((err: { row: number; field: string; message: string }, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md px-3 py-2 text-xs bg-destructive/5 border border-destructive/20"
              >
                <AlertTriangle className="size-3 text-destructive shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-muted-foreground">Row {err.row}:</span>{" "}
                  <span className="text-destructive">{err.field}</span> — {err.message}
                </div>
              </div>
            ))}
            {importData?.presets.map((preset, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs"
              >
                <Check className="size-3 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">{preset.name}</span> — {preset.label}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({preset.action}{preset.action === "LIVEPIX_PAYMENT" ? ` R$${preset.price?.toFixed(2)}` : ""})
                  </span>
                </div>
              </div>
            ))}
            {!importData?.presets.length && !importData?.errors.length && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No data found in CSV
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportData(null);
                setImportPreviewOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmImport}
              disabled={validCount === 0}
            >
              Import {validCount} preset{validCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
