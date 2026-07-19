import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ButtonAction, ButtonColor, MessageButton } from "@/types";

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

export function InlineButtonEditor({ button, onChange, onRemove }: InlineButtonEditorProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3">
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
