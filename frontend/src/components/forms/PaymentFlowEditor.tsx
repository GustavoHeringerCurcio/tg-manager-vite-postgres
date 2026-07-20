import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Upload, Download, X, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { LivePixResponse } from "@/types";
import {
  parseCsvFile,
  parsePaymentFlowCsv,
  exportPaymentFlowCsv,
  downloadCsv,
} from "@/lib/csv";
import { toast } from "sonner";
import { newId } from "@/lib/helpers";

function newResponse(): LivePixResponse {
  return {};
}

function SortableResponse({
  response,
  index,
  onChange,
  onRemove,
}: {
  response: LivePixResponse;
  index: number;
  onChange: (response: LivePixResponse) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "space-y-2 rounded-md border border-border/40 bg-background/50 p-3",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            {...attributes}
            {...listeners}
            className="flex shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            <GripVertical className="size-3.5" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground">
            Response {index + 1}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onRemove}>
          <X className="size-3" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px]">Text</Label>
        <Textarea
          value={response.text ?? ""}
          onChange={(e) => onChange({ ...response, text: e.target.value || undefined })}
          className="h-12 text-xs resize-none"
          placeholder="Use {amount}, {pix_code}, {checkout_url} as placeholders"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Image URL</Label>
          <Input
            value={response.imageUrl ?? ""}
            onChange={(e) => onChange({ ...response, imageUrl: e.target.value || undefined })}
            className="h-7 text-xs"
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Audio URL</Label>
          <Input
            value={response.audioUrl ?? ""}
            onChange={(e) => onChange({ ...response, audioUrl: e.target.value || undefined })}
            className="h-7 text-xs"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px]">Video URL</Label>
        <Input
          value={response.videoUrl ?? ""}
          onChange={(e) => onChange({ ...response, videoUrl: e.target.value || undefined })}
          className="h-7 text-xs"
          placeholder="https://..."
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={response.includeQrCode ?? false}
            onCheckedChange={(v) => onChange({ ...response, includeQrCode: v || undefined })}
            className="scale-75"
          />
          <span className="text-[10px]">QR Code</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={response.includePixCode ?? false}
            onCheckedChange={(v) => onChange({ ...response, includePixCode: v || undefined })}
            className="scale-75"
          />
          <span className="text-[10px]">PIX Code</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Switch
            checked={response.includeCheckoutUrl ?? false}
            onCheckedChange={(v) => onChange({ ...response, includeCheckoutUrl: v || undefined })}
            className="scale-75"
          />
          <span className="text-[10px]">LivePix Link</span>
        </label>
      </div>
    </div>
  );
}

interface PaymentFlowEditorProps {
  responses: LivePixResponse[];
  onChange: (responses: LivePixResponse[]) => void;
  botName?: string;
}

export default function PaymentFlowEditor({ responses, onChange, botName = "bot" }: PaymentFlowEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function addResponse() {
    onChange([...responses, newResponse()]);
  }

  function updateResponse(index: number, updated: LivePixResponse) {
    const next = [...responses];
    next[index] = updated;
    onChange(next);
  }

  function removeResponse(index: number) {
    onChange(responses.filter((_, i) => i !== index));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    if (isNaN(oldIndex) || isNaN(newIndex)) return;
    onChange(arrayMove(responses, oldIndex, newIndex));
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseCsvFile(file);
      const rows = parsePaymentFlowCsv(result.data);
      if (rows.length === 0) {
        toast.error("No response rows found in CSV");
        return;
      }
      onChange(rows);
      toast.success(`Imported ${rows.length} response${rows.length !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to parse CSV file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleExport() {
    const csv = exportPaymentFlowCsv(responses);
    if (!csv) {
      toast.error("No responses configured to export");
      return;
    }
    const slug = botName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    downloadCsv(`payment_flow_${slug}.csv`, csv);
    toast.success("Payment flow exported");
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImport}
      />

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">Payment Responses</Label>
          <p className="text-xs text-muted-foreground">
            {responses.length} response{responses.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            disabled={responses.length === 0}
          >
            <Download className="mr-1 size-3" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={addResponse}>
            <Plus className="mr-1 size-3.5" /> Add Response
          </Button>
        </div>
      </div>

      {responses.length === 0 ? (
        <button
          onClick={addResponse}
          className="flex w-full flex-col items-center gap-3 py-10 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Plus className="size-5 text-muted-foreground/60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No responses configured</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Add payment response messages to send when users tap a LivePix button
            </p>
          </div>
        </button>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={responses.map((_, i) => `${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {responses.map((resp, i) => (
                <SortableResponse
                  key={i}
                  response={resp}
                  index={i}
                  onChange={(updated) => updateResponse(i, updated)}
                  onRemove={() => removeResponse(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
