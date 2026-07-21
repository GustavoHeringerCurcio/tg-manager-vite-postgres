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
  Image,
  ChevronRight,
  Activity,
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
  showPaymentOptions?: boolean;
  livepixConfigured?: boolean;
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
  IMAGE: {
    label: "Image",
    icon: <Image className="size-3" />,
    color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
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
  showPaymentOptions = false,
  livepixConfigured = true,
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
    const clearButtons = (step.type === "VIDEO" || step.type === "IMAGE") && newUrls.length > 1 && step.buttons.length > 0;
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
  const isMediaGroup = (step.type === "VIDEO" || step.type === "IMAGE") && step.mediaUrls.length > 1;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-2 border-border/50 bg-muted dark:bg-black",
        isDragging && "opacity-60 shadow-2xl z-50 relative scale-[1.02] border-primary/40",
        isExpanded && "border-primary/30",
        !isDragging && "transition-all duration-200"
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <div className="flex items-center gap-1 px-3 py-2.5 border-l-2 border-l-transparent hover:border-l-foreground/30 hover:bg-muted/30 transition-colors duration-150">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex shrink-0 cursor-grab touch-none active:cursor-grabbing text-muted-foreground/60 hover:text-foreground transition-colors rounded-md hover:bg-muted/50 p-1 -ml-1"
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
                    isExpanded ? "bg-primary text-primary-foreground" : "bg-muted-foreground/15 text-muted-foreground"
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
                {step.chatAction && (
                  <span className="text-[10px] text-muted-foreground/70 shrink-0" title={step.type === "TEXT" ? "Typing..." : step.type === "AUDIO" ? "Recording..." : step.type === "IMAGE" ? "Uploading photo..." : "Uploading video..."}>
                    <Activity className="size-3 inline" />
                  </span>
                )}
                {step.buttons.length > 0 && (
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                    {step.buttons.length} btn{step.buttons.length > 1 ? "s" : ""}
                  </span>
                )}
                {step.delayMs > 0 && (
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
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
                    const clearButtons = (newType === "VIDEO" || newType === "IMAGE") && step.mediaUrls.length > 1 && step.buttons.length > 0;
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
                    <SelectItem value="IMAGE">Image</SelectItem>
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

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Switch
                  size="sm"
                  checked={step.chatAction ?? false}
                  onCheckedChange={(v) => {
                    const updates: Partial<MessageStep> = { chatAction: v || undefined };
                    if (v && step.delayMs === 0) {
                      updates.delayMs = 5000;
                    }
                    update(updates);
                  }}
                />
                <span className={step.chatAction ? "text-[10px] font-medium text-emerald-400" : "text-[10px] text-muted-foreground"}>
                  {step.chatAction
                    ? step.type === "AUDIO" ? "Recording..." : step.type === "IMAGE" ? "Uploading photo..." : "Uploading video..."
                    : step.type === "AUDIO" ? "Recording..." : step.type === "IMAGE" ? "Uploading photo..." : "Uploading video..."}
                </span>
              </label>
            </div>

            {(step.type === "TEXT" || step.type === "VIDEO" || step.type === "IMAGE" || step.type === "AUDIO") && (
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
                  {step.type === "AUDIO" ? "Voice note (OGG)" : "Media"} URL or file_id
                </Label>
                {step.mediaUrls.map((url, i) => (
                  <div key={i} className="flex gap-1">
                    <Input
                      value={url}
                      onChange={(e) => updateMediaUrl(i, e.target.value)}
                      placeholder={step.type === "AUDIO" ? "Telegram voice file_id (OGG)" : "Telegram file_id or media URL"}
                      className="h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeMediaUrl(i)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
                {step.mediaUrls.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50">
                    Add a Telegram {step.type === "AUDIO" ? "voice" : "media"} file_id or URL to send
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={addMediaUrl} className="h-7 text-xs">
                  <Plus className="mr-1 size-3" /> Add file_id
                </Button>
              </div>
            )}

            {step.type === "AUDIO" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-[11px]">Daily Custom Audios</Label>
                  <Switch
                    size="sm"
                    checked={step.dailyAudios?.enabled ?? false}
                    onCheckedChange={(v) =>
                      update({
                        dailyAudios: v
                          ? { enabled: true, audios: step.dailyAudios?.audios ?? {} }
                          : { ...step.dailyAudios, enabled: false, audios: step.dailyAudios?.audios ?? {} },
                      })
                    }
                  />
                </div>
                {step.dailyAudios?.enabled && (
                  <div className="space-y-2 animate-fade-in pl-2 border-l-2 border-amber-500/20">
                    {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map(
                      (day) => (
                        <div key={day} className="flex items-center gap-2">
                          <Label className="text-[11px] w-20 capitalize">{day}</Label>
                          <Input
                            value={step.dailyAudios?.audios[day] ?? ""}
                            onChange={(e) =>
                              update({
                                dailyAudios: {
                                  ...step.dailyAudios!,
                                  audios: { ...step.dailyAudios!.audios, [day]: e.target.value },
                                },
                              })
                            }
                            placeholder="file_id"
                            className="h-8 text-sm flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              const { [day]: _, ...rest } = step.dailyAudios!.audios;
                              update({ dailyAudios: { ...step.dailyAudios!, audios: rest } });
                            }}
                            title={`Remove ${day}`}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Label className="text-[11px] w-20">Fallback</Label>
                      <Input
                        value={step.dailyAudios?.fallback ?? ""}
                        onChange={(e) =>
                          update({
                            dailyAudios: { ...step.dailyAudios!, fallback: e.target.value || undefined },
                          })
                        }
                        placeholder="file_id (used when a day is missing)"
                        className="h-8 text-sm flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {showPaymentOptions && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Payment Options</Label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Sends a QR code image right after this step">
                    <Switch
                      size="sm"
                      checked={step.includeQrCode ?? false}
                      onCheckedChange={(v) => update({ includeQrCode: v || undefined })}
                    />
                    <span className={step.includeQrCode ? "text-[10px] font-medium text-emerald-400" : "text-[10px] text-muted-foreground"}>
                      {step.includeQrCode ? "QR Code ON" : "QR Code OFF"}
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Appends the PIX copy-paste code at the end of this message">
                    <Switch
                      size="sm"
                      checked={step.includePixCode ?? false}
                      onCheckedChange={(v) => update({ includePixCode: v || undefined })}
                    />
                    <span className={step.includePixCode ? "text-[10px] font-medium text-emerald-400" : "text-[10px] text-muted-foreground"}>
                      {step.includePixCode ? "PIX Code ON" : "PIX Code OFF"}
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Appends the LivePix checkout URL at the end of this message">
                    <Switch
                      size="sm"
                      checked={step.includeCheckoutUrl ?? false}
                      onCheckedChange={(v) => update({ includeCheckoutUrl: v || undefined })}
                    />
                    <span className={step.includeCheckoutUrl ? "text-[10px] font-medium text-emerald-400" : "text-[10px] text-muted-foreground"}>
                      {step.includeCheckoutUrl ? "LivePix Link ON" : "LivePix Link OFF"}
                    </span>
                  </label>
                </div>
              </div>
            )}

            {isMediaGroup ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  Telegram media groups (multiple {step.type === "IMAGE" ? "images" : "videos"}) don&apos;t support inline buttons. To add buttons, create a separate <strong className="text-amber-300">TEXT</strong> message step after this media group.
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
                    livepixConfigured={livepixConfigured}
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
