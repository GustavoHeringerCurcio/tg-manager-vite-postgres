import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, GripVertical, Trash2, Copy, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { useState } from "react";
import type { MessageStep, MessageType, ButtonAction, ButtonColor, MessageButton } from "@/types";
import { newId } from "@/lib/helpers";

interface MessageStepCardProps {
  step: MessageStep;
  index: number;
  total: number;
  onChange: (step: MessageStep) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const typeLabels: Record<MessageType, string> = {
  TEXT: "Text",
  AUDIO: "Audio",
  VIDEO: "Video",
};

export default function MessageStepCard({
  step,
  index,
  total,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: MessageStepCardProps) {
  const [open, setOpen] = useState(true);

  function update(fields: Partial<MessageStep>) {
    onChange({ ...step, ...fields });
  }

  function updateButton(btnIndex: number, fields: Partial<MessageButton>) {
    const buttons = [...step.buttons];
    buttons[btnIndex] = { ...buttons[btnIndex], ...fields };
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
    update({ mediaUrls: [...step.mediaUrls, ""] });
  }

  function updateMediaUrl(idx: number, val: string) {
    const urls = [...step.mediaUrls];
    urls[idx] = val;
    update({ mediaUrls: urls });
  }

  function removeMediaUrl(idx: number) {
    update({ mediaUrls: step.mediaUrls.filter((_, i) => i !== idx) });
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <GripVertical className="size-4 cursor-grab text-muted-foreground" />
            <CollapsibleTrigger
              render={
                <button className="flex flex-1 items-center gap-2 text-left">
                  <ChevronDown className="size-4 transition-transform data-[state=open]:rotate-180" />
                  <span className="font-medium text-sm">Step {index + 1}</span>
                  <span className="text-sm text-muted-foreground">— {step.title}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {typeLabels[step.type]}
                  </Badge>
                </button>
              }
            />
            <div className="flex items-center gap-0.5">
              {onMoveUp && (
                <Button variant="ghost" size="icon-xs" onClick={onMoveUp} disabled={index === 0}>
                  <ArrowUp className="size-3" />
                </Button>
              )}
              {onMoveDown && (
                <Button variant="ghost" size="icon-xs" onClick={onMoveDown} disabled={index === total - 1}>
                  <ArrowDown className="size-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon-xs" onClick={onDuplicate}>
                <Copy className="size-3" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={onRemove}>
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`step-${step.id}-title`}>Admin Title</Label>
                <Input
                  id={`step-${step.id}-title`}
                  value={step.title}
                  onChange={(e) => update({ title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Message Type</Label>
                <Select
                  value={step.type}
                  onValueChange={(v) => update({ type: v as MessageType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="AUDIO">Audio</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`step-${step.id}-delay`}>Delay (seconds)</Label>
                <Input
                  id={`step-${step.id}-delay`}
                  type="number"
                  min={0}
                  value={Math.round(step.delayMs / 1000)}
                  onChange={(e) => update({ delayMs: Number(e.target.value) * 1000 })}
                />
              </div>
            </div>

            {(step.type === "TEXT" || step.type === "VIDEO" || step.type === "AUDIO") && (
              <div className="space-y-2">
                <Label htmlFor={`step-${step.id}-text`}>
                  {step.type === "TEXT" ? "Message Text" : "Caption"}
                </Label>
                <Textarea
                  id={`step-${step.id}-text`}
                  value={step.text ?? ""}
                  onChange={(e) => update({ text: e.target.value })}
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Media URLs (file_id)</Label>
              {step.mediaUrls.map((url, i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    value={url}
                    onChange={(e) => updateMediaUrl(i, e.target.value)}
                    placeholder="Telegram file_id or URL"
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => removeMediaUrl(i)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
              {step.mediaUrls.length === 0 && (
                <p className="text-xs text-muted-foreground">No media files</p>
              )}
              <Button variant="outline" size="sm" onClick={addMediaUrl}>
                <Plus className="mr-1 size-3" /> Add file_id
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Inline Buttons</Label>
              {step.buttons.map((btn, i) => (
                <div key={btn.id} className="space-y-2 rounded-md border p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={btn.label}
                        onChange={(e) => updateButton(i, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Action</Label>
                      <Select
                        value={btn.action}
                        onValueChange={(v) => {
                          const action = v as ButtonAction;
                          updateButton(i, {
                            action,
                            label: action === "LIVEPIX_PAYMENT" ? "Pagar agora" : "Abrir link",
                            color: action === "LIVEPIX_PAYMENT" ? "GREEN" : "BLUE",
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN_URL">Open URL</SelectItem>
                          <SelectItem value="LIVEPIX_PAYMENT">LivePix Payment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Color</Label>
                      <Select
                        value={btn.color}
                        onValueChange={(v) => updateButton(i, { color: v as ButtonColor })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BLUE">Blue</SelectItem>
                          <SelectItem value="GREEN">Green</SelectItem>
                          <SelectItem value="RED">Red</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {btn.action === "OPEN_URL" && (
                    <div className="space-y-1">
                      <Label className="text-xs">URL</Label>
                      <Input
                        value={btn.url ?? ""}
                        onChange={(e) => updateButton(i, { url: e.target.value })}
                        placeholder="https://example.com"
                      />
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-destructive"
                    onClick={() => removeButton(i)}
                  >
                    <Trash2 className="mr-1 size-3" /> Remove button
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addButton}
                disabled={step.buttons.length >= 3}
              >
                <Plus className="mr-1 size-3" /> Add button
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
