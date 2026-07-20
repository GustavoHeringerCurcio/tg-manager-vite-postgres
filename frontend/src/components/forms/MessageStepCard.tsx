import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  GripVertical,
  Trash2,
  Copy,
  Plus,
  MessageSquare,
  Music,
  Video,
  ChevronRight,
} from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import type { MessageStep, MessageType, MessageButton } from "@/types";
import { newId } from "@/lib/helpers";
import { InlineButtonEditor } from "./InlineButtonEditor";

interface MessageStepCardProps {
  step: MessageStep;
  index: number;
  total: number;
  isExpanded: boolean;
  onToggle: (open: boolean) => void;
  onChange: (step: MessageStep) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

const typeConfig: Record<MessageType, { label: string; icon: React.ReactNode; color: string }> = {
  TEXT: {
    label: "Text",
    icon: <MessageSquare className="size-3" />,
    color: "border-border bg-secondary/50 text-secondary-foreground",
  },
  AUDIO: {
    label: "Audio",
    icon: <Music className="size-3" />,
    color: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  VIDEO: {
    label: "Video",
    icon: <Video className="size-3" />,
    color: "border-violet-500/20 bg-violet-500/10 text-violet-400",
  },
};

function MessageStepCardInner({
  step,
  index,
  total,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
}: MessageStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function update(fields: Partial<MessageStep>) {
    onChange({ ...step, ...fields });
  }

  function updateButton(btnIndex: number, fields: Partial<MessageButton>) {
    const buttons = [...step.buttons];
    buttons[btnIndex] = { ...buttons[btnIndex], ...fields };
    if (buttons[btnIndex].action === "OPEN_URL") {
      delete buttons[btnIndex].price;
    } else if (buttons[btnIndex].action === "LIVEPIX_PAYMENT") {
      delete buttons[btnIndex].url;
    }
    update({ buttons });
  }

  function addButton() {
    if (step.buttons.length >= 3) return;
    const btn: MessageButton = {
      id: newId(),
      label: "Abrir link",
      color: "BLUE",
      action: "OPEN_URL",
      url: "",
    };
    update({ buttons: [...step.buttons, btn] });
  }

  function removeButton(btnIndex: number) {
    update({ buttons: step.buttons.filter((_, i) => i !== btnIndex) });
  }

  function addMediaUrl() {
    const newUrls = [...step.mediaUrls, ""];
    const clearButtons = step.type === "VIDEO" && newUrls.length > 1 && step.buttons.length > 0;
    update({ mediaUrls: newUrls, ...(clearButtons ? { buttons: [] } : {}) });
  }

  function updateMediaUrl(idx: number, val: string) {
    const urls = [...step.mediaUrls];
    urls[idx] = val;
    update({ mediaUrls: urls });
  }

  function removeMediaUrl(idx: number) {
    update({ mediaUrls: step.mediaUrls.filter((_, i) => i !== idx) });
  }

  const type = typeConfig[step.type];
  const hasContent = step.text || step.mediaUrls.length > 0 || step.buttons.length > 0;
  const isMultiVideo = step.type === "VIDEO" && step.mediaUrls.length > 1;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "shadow-sm ring-1 ring-border/40 transition-all",
        isDragging && "opacity-50 shadow-lg z-50",
        isExpanded && "ring-primary/30"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <div className="flex items-center gap-1 px-3 py-2.5">
          <button
            {...attributes}
            {...listeners}
            className="flex shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors p-0.5"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>

          <CollapsibleTrigger
            render={
              <button className="flex flex-1 items-center gap-2.5 text-left min-w-0 py-0.5">
                <ChevronRight
                  className={cn(
                    "size-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                    isExpanded && "rotate-90"
                  )}
                />
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold tabular-nums",
                    isExpanded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <span className="font-medium text-sm truncate">{step.title}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] gap-1 shrink-0",
                    type.color
                  )}
                >
                  {type.icon}
                  {type.label}
                </Badge>
                {step.buttons.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
                    {step.buttons.length} btn{step.buttons.length > 1 ? "s" : ""}
                  </span>
                )}
                {step.delayMs > 0 && (
                  <span className="text-[10px] text-muted-foreground/30 shrink-0 tabular-nums">
                    {Math.round(step.delayMs / 1000)}s
                  </span>
                )}
              </button>
            }
          />

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate step"
            >
              <Copy className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Delete step"
            >
              <Trash2 className="size-3 text-destructive" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0 px-4 pb-4 animate-fade-in">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor={`step-${step.id}-title`} className="text-[11px]">
                  Admin Title
                </Label>
                <Input
                  id={`step-${step.id}-title`}
                  value={step.title}
                  onChange={(e) => update({ title: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Welcome message"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Message Type</Label>
                <Select
                  value={step.type}
                  onValueChange={(v) => {
                    const newType = v as MessageType;
                    const clearButtons = newType === "VIDEO" && step.mediaUrls.length > 1 && step.buttons.length > 0;
                    update({ type: newType, ...(clearButtons ? { buttons: [] } : {}) });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="AUDIO">Audio</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`step-${step.id}-delay`} className="text-[11px]">
                  Delay (seconds)
                </Label>
                <Input
                  id={`step-${step.id}-delay`}
                  type="number"
                  min={0}
                  value={Math.round(step.delayMs / 1000)}
                  onChange={(e) => update({ delayMs: Number(e.target.value) * 1000 })}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {(step.type === "TEXT" || step.type === "VIDEO" || step.type === "AUDIO") && (
              <div className="space-y-1.5">
                <Label htmlFor={`step-${step.id}-text`} className="text-[11px]">
                  {step.type === "TEXT" ? "Message Text" : "Caption"}
                </Label>
                <Textarea
                  id={`step-${step.id}-text`}
                  value={step.text ?? ""}
                  onChange={(e) => update({ text: e.target.value })}
                  rows={3}
                  className="text-sm resize-y"
                />
                {!hasContent && step.type === "TEXT" && (
                  <p className="text-[10px] text-muted-foreground/50">
                    Enter the message users will receive. Use empty lines for paragraph breaks.
                  </p>
                )}
              </div>
            )}

            {step.type !== "TEXT" && (
              <div className="space-y-1.5">
                <Label className="text-[11px]">
                  {step.type === "AUDIO" ? "Voice note (OGG)" : "Video"} file_id
                </Label>
                {step.mediaUrls.map((url, i) => (
                  <div key={i} className="flex gap-1">
                    <Input
                      value={url}
                      onChange={(e) => updateMediaUrl(i, e.target.value)}
                      placeholder="Telegram voice file_id (OGG)"
                      className="h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeMediaUrl(i)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
                {step.mediaUrls.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50">
                    Add a Telegram voice file_id (OGG) to send as voice note
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={addMediaUrl} className="h-7 text-xs">
                  <Plus className="mr-1 size-3" /> Add file_id
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Payment Options</Label>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer" title="Sends a QR code image right after this step">
                  <Switch
                    checked={step.includeQrCode ?? false}
                    onCheckedChange={(v) => update({ includeQrCode: v || undefined })}
                    className="scale-75"
                  />
                  <span className={step.includeQrCode ? "text-[10px] font-medium text-emerald-400" : "text-[10px] text-muted-foreground"}>
                    {step.includeQrCode ? "QR Code ON" : "QR Code OFF"}
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer" title="Appends the PIX copy-paste code at the end of this message">
                  <Switch
                    checked={step.includePixCode ?? false}
                    onCheckedChange={(v) => update({ includePixCode: v || undefined })}
                    className="scale-75"
                  />
                  <span className={step.includePixCode ? "text-[10px] font-medium text-emerald-400" : "text-[10px] text-muted-foreground"}>
                    {step.includePixCode ? "PIX Code ON" : "PIX Code OFF"}
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer" title="Appends the LivePix checkout URL at the end of this message">
                  <Switch
                    checked={step.includeCheckoutUrl ?? false}
                    onCheckedChange={(v) => update({ includeCheckoutUrl: v || undefined })}
                    className="scale-75"
                  />
                  <span className={step.includeCheckoutUrl ? "text-[10px] font-medium text-emerald-400" : "text-[10px] text-muted-foreground"}>
                    {step.includeCheckoutUrl ? "LivePix Link ON" : "LivePix Link OFF"}
                  </span>
                </label>
              </div>
            </div>

            {isMultiVideo ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  Telegram media groups (multiple videos) don&apos;t support inline buttons. To add buttons, create a separate <strong className="text-amber-300">TEXT</strong> message step after this video group.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Inline Buttons</Label>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {step.buttons.length}/3
                  </span>
                </div>
                {step.buttons.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50">
                    Add buttons to let users open links or make payments directly from the message.
                  </p>
                )}
                {step.buttons.map((btn, i) => (
                  <InlineButtonEditor
                    key={btn.id}
                    button={btn}
                    onChange={(fields) => updateButton(i, fields)}
                    onRemove={() => removeButton(i)}
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={step.buttons.length >= 3}
                  className="h-7 text-xs"
                >
                  <Plus className="mr-1 size-3" /> Add button
                  {step.buttons.length >= 3 && " (max 3)"}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default memo(MessageStepCardInner);
