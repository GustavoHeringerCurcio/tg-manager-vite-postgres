import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, ExternalLink, CreditCard, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ButtonAction, ButtonColor, LivePixResponse, MessageButton } from "@/types";
import { useButtonPresets } from "@/hooks/useButtonPresets";

interface InlineButtonEditorProps {
  button: MessageButton;
  onChange: (fields: Partial<MessageButton>) => void;
  onRemove: () => void;
}

const colorSwatches: { value: ButtonColor; bg: string; ring: string }[] = [
  { value: "BLUE", bg: "bg-blue-500", ring: "ring-blue-400" },
  { value: "GREEN", bg: "bg-emerald-500", ring: "ring-emerald-400" },
  { value: "RED", bg: "bg-red-500", ring: "ring-red-400" },
];

const actionCards: { value: ButtonAction; icon: React.ReactNode; title: string; desc: string }[] = [
  {
    value: "OPEN_URL",
    icon: <ExternalLink className="size-4" />,
    title: "Open URL",
    desc: "Link to a website",
  },
  {
    value: "LIVEPIX_PAYMENT",
    icon: <CreditCard className="size-4" />,
    title: "LivePix Payment",
    desc: "Integrated checkout",
  },
];

function newResponse(): LivePixResponse {
  return {};
}

function ResponseEditor({
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
  return (
    <div className="space-y-2 rounded-md border border-border/40 bg-background/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">
          Response {index + 1}
        </span>
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

export function InlineButtonEditor({ button, onChange, onRemove }: InlineButtonEditorProps) {
  const { presets } = useButtonPresets();
  const responses = button.responses ?? [];

  function handlePresetSelect(presetId: string | null) {
    if (!presetId) return;
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    onChange({
      label: preset.label,
      action: preset.action,
      color: preset.color,
      url: preset.url,
      price: preset.price,
    });
  }

  function setResponses(newResponses: LivePixResponse[]) {
    onChange({ responses: newResponses.length > 0 ? newResponses : undefined });
  }

  function updateResponse(index: number, updated: LivePixResponse) {
    const next = [...responses];
    next[index] = updated;
    setResponses(next);
  }

  function removeResponse(index: number) {
    setResponses(responses.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
      {presets.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[11px]">From Preset</Label>
          <Select value="" onValueChange={handlePresetSelect}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select a preset..." />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name} ({preset.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px]">Label</Label>
        <Input
          value={button.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-8 text-sm"
          placeholder="Button text"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px]">Action</Label>
        <div className="grid grid-cols-2 gap-2">
          {actionCards.map((card) => (
            <button
              key={card.value}
              type="button"
              onClick={() => {
                onChange({
                  action: card.value,
                  label: card.value === "LIVEPIX_PAYMENT" ? "Pagar agora" : button.label || "Abrir link",
                  color: card.value === "LIVEPIX_PAYMENT" ? "GREEN" : "BLUE",
                  ...(card.value === "LIVEPIX_PAYMENT" ? { price: button.price ?? 29.9 } : {}),
                });
              }}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all",
                button.action === card.value
                  ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/50 hover:border-border hover:bg-muted/30"
              )}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md",
                  button.action === card.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {card.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium">{card.title}</p>
                <p className="text-[10px] text-muted-foreground">{card.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {button.action === "OPEN_URL" && (
        <div className="space-y-1.5 animate-fade-in">
          <Label className="text-[11px]">URL</Label>
          <Input
            value={button.url ?? ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://example.com"
            className="h-8 text-sm"
          />
        </div>
      )}

      {button.action === "LIVEPIX_PAYMENT" && (
        <div className="space-y-1.5 animate-fade-in">
          <Label className="text-[11px]">Price (R$)</Label>
          <Input
            type="number"
            min={0.01}
            step={0.01}
            value={button.price ?? 0}
            onChange={(e) => onChange({ price: Number(e.target.value) })}
            className="h-8 text-sm"
            placeholder="29.90"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-[11px]">Color</Label>
        <div className="flex gap-2">
          {colorSwatches.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              onClick={() => onChange({ color: swatch.value })}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                button.color === swatch.value
                  ? "border-transparent text-white shadow-sm scale-105"
                  : "border-border/50 text-muted-foreground hover:border-border",
                button.color === swatch.value ? swatch.bg : "bg-background",
                button.color === swatch.value && swatch.ring
              )}
            >
              <span
                className={cn(
                  "size-3 rounded-full border border-white/20",
                  swatch.bg
                )}
              />
              {swatch.value === "BLUE" ? "Blue" : swatch.value === "GREEN" ? "Green" : "Red"}
            </button>
          ))}
        </div>
      </div>

      {button.action === "LIVEPIX_PAYMENT" && (
        <div className="space-y-2 animate-fade-in pt-1 border-t border-border/30">
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Response Messages</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setResponses([...responses, newResponse()])}
            >
              <Plus className="size-3 mr-1" /> Add
            </Button>
          </div>
          {responses.map((resp, i) => (
            <ResponseEditor
              key={i}
              response={resp}
              index={i}
              onChange={(updated) => updateResponse(i, updated)}
              onRemove={() => removeResponse(i)}
            />
          ))}
          {responses.length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              No response messages defined. A default payment message will be sent.
            </p>
          )}
        </div>
      )}

      <div className="pt-1.5 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="mr-1 size-3" /> Remove
        </Button>
      </div>
    </div>
  );
}
