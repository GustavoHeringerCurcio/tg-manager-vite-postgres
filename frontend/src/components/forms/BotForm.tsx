import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import MessageFlowEditor from "./MessageFlowEditor";
import RemarketingEditor from "./RemarketingEditor";
import TimeComplimentsEditor from "./TimeComplimentsEditor";
import ButtonPresetsManager from "./ButtonPresetsManager";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import type { Bot as BotType, BotPayload, RemarketingConfig, MessageStep, PaymentFlow, TimeComplimentConfig } from "@/types";
import { Settings, Save, Workflow, Timer, Percent, Plus, X, Clock } from "lucide-react";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const defaultRemarketing: RemarketingConfig = {
  enabled: false,
  intervalMs: 86400000,
  initialDelayMs: 0,
  maxSends: 0,
  messages: [],
  discountOffer: { enabled: false, tiers: [] },
};

interface BotFormProps {
  bot?: BotType | null;
  saving: boolean;
  onSave: (payload: BotPayload) => void;
  onCancel: () => void;
  requireToken?: boolean;
  mode?: "create" | "messages" | "remarketing";
}

export default function BotForm({ bot, saving, onSave, onCancel, requireToken, mode }: BotFormProps) {
  const isEditing = Boolean(bot);
  const [name, setName] = useState(bot?.name ?? "");
  const [token, setToken] = useState("");
  const [messageFlow, setMessageFlow] = useState<MessageStep[]>(bot?.messageFlow ?? []);
  const [remarketing, setRemarketing] = useState<RemarketingConfig>(
    bot?.remarketing ?? defaultRemarketing
  );
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow>(bot?.paymentFlow ?? { steps: [], verifyLabel: "Verificar pagamento", pixCopyLabel: "Copiar PIX" });
  const [timeCompliments, setTimeCompliments] = useState<TimeComplimentConfig>(bot?.timeCompliments ?? { timezone: "America/Sao_Paulo", presets: [] });
  const [settingsOpen, setSettingsOpen] = useState(!isEditing);

  const initial = useMemo(() => ({
    name: bot?.name ?? "",
    messageFlow: bot?.messageFlow ?? [],
    remarketing: bot?.remarketing ?? defaultRemarketing,
    paymentFlow: bot?.paymentFlow ?? { steps: [], verifyLabel: "Verificar pagamento", pixCopyLabel: "Copiar PIX" },
    timeCompliments: bot?.timeCompliments ?? { timezone: "America/Sao_Paulo", presets: [] },
  }), [bot]);

  const current = {
    name,
    messageFlow,
    remarketing,
    paymentFlow,
    timeCompliments,
  };

  const isDirty = !deepEqual(initial, current);
  useUnsavedChanges(isDirty);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: BotPayload = {
      name,
      messageFlow,
      remarketing,
      paymentFlow,
      timeCompliments,
    };
    if (requireToken || token) payload.token = token;
    onSave(payload);
  }

  const settingsSummary = [
    name && `"${name}"`,
    token && "Token set",
    !name && "No name set",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CollapsibleSection
        title="Bot Settings"
        summary={settingsSummary || "Configure bot name, token, and pricing"}
        icon={<Settings className="size-4 text-muted-foreground" />}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        dirty={isDirty && !deepEqual(initial, current)}
      >
        <div className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bot-name" className="text-xs">Bot Name</Label>
              <Input id="bot-name" value={name} onChange={(e) => setName(e.target.value)} required className="h-8" />
            </div>
            {(requireToken || isEditing) && (
              <div className="space-y-2">
                <Label htmlFor="bot-token" className="text-xs">
                  Telegram Token {!requireToken && "(leave blank to keep current)"}
                </Label>
                <Input
                  id="bot-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  required={requireToken}
                  className="h-8"
                />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {mode !== "remarketing" && (
        <CollapsibleSection
          title="Message Flow"
          summary={`${messageFlow.length} step${messageFlow.length !== 1 ? "s" : ""}`}
          icon={<Workflow className="size-4 text-emerald-400" />}
          open={true}
          onOpenChange={() => {}}
          dirty={isDirty && !deepEqual(initial.messageFlow, messageFlow)}
        >
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-end">
              <ButtonPresetsManager />
            </div>
            <MessageFlowEditor steps={messageFlow} onChange={setMessageFlow} />
          </div>
        </CollapsibleSection>
      )}

      {mode !== "messages" && (
        <CollapsibleSection
          title="Remarketing"
          summary={
            remarketing.enabled
              ? `${remarketing.messages.length} follow-up message${remarketing.messages.length !== 1 ? "s" : ""}`
              : "Disabled"
          }
          icon={<Timer className="size-4 text-amber-400" />}
          open={true}
          onOpenChange={() => {}}
        >
          <div className="pt-4">
            <RemarketingEditor config={remarketing} onChange={setRemarketing} />
          </div>
        </CollapsibleSection>
      )}

      {mode !== "messages" && (
        <CollapsibleSection
          title="Discount Offers"
          summary={
            remarketing.discountOffer.enabled
              ? remarketing.discountOffer.tiers.length > 0
                ? `${remarketing.discountOffer.tiers.length} tier${remarketing.discountOffer.tiers.length !== 1 ? "s" : ""}`
                : "No tiers configured"
              : "Disabled"
          }
          icon={<Percent className="size-4 text-violet-400" />}
          open={true}
          onOpenChange={() => {}}
        >
          <div className="pt-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Reduce prices on payment buttons after a certain number of remarketing messages
                </p>
              </div>
              <Switch
                checked={remarketing.discountOffer.enabled}
                onCheckedChange={(v) =>
                  setRemarketing({ ...remarketing, discountOffer: { ...remarketing.discountOffer, enabled: v } })
                }
              />
            </div>

            {remarketing.discountOffer.enabled && (
              <div className="space-y-3 animate-fade-in">
                {remarketing.discountOffer.tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-3 py-2.5"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">After Messages</Label>
                        <Input
                          type="number"
                          min={1}
                          value={tier.afterMessages}
                          onChange={(e) => {
                            const tiers = [...remarketing.discountOffer.tiers];
                            tiers[index] = { ...tier, afterMessages: Math.max(1, Number(e.target.value)) };
                            setRemarketing({ ...remarketing, discountOffer: { ...remarketing.discountOffer, tiers } });
                          }}
                          className="h-7 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Discount (%)</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            value={tier.percentage}
                            onChange={(e) => {
                              const tiers = [...remarketing.discountOffer.tiers];
                              tiers[index] = { ...tier, percentage: Math.min(99, Math.max(1, Number(e.target.value))) };
                              setRemarketing({ ...remarketing, discountOffer: { ...remarketing.discountOffer, tiers } });
                            }}
                            className="h-7 text-sm pr-7"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-medium">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const tiers = remarketing.discountOffer.tiers.filter((_, i) => i !== index);
                        setRemarketing({ ...remarketing, discountOffer: { ...remarketing.discountOffer, tiers } });
                      }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={() => {
                    const tiers = [...remarketing.discountOffer.tiers, { afterMessages: 3, percentage: 20 }];
                    setRemarketing({ ...remarketing, discountOffer: { ...remarketing.discountOffer, tiers } });
                  }}
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Add Tier
                </Button>

                {remarketing.discountOffer.tiers.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {remarketing.discountOffer.tiers
                      .sort((a, b) => a.afterMessages - b.afterMessages)
                      .map((t) => `after ${t.afterMessages} msgs → ${t.percentage}% off`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Time Compliments"
        summary={
          timeCompliments.presets.length > 0
            ? `${timeCompliments.presets.length} preset${timeCompliments.presets.length !== 1 ? "s" : ""} · ${timeCompliments.timezone}`
            : "No presets configured"
        }
        icon={<Clock className="size-4 text-sky-400" />}
        open={true}
        onOpenChange={() => {}}
      >
        <div className="pt-4">
          <TimeComplimentsEditor config={timeCompliments} onChange={setTimeCompliments} />
        </div>
      </CollapsibleSection>

      <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-background/80 backdrop-blur-xl border-t flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="flex size-1.5 rounded-full bg-amber-400 animate-pulse-dot" />
              Unsaved changes
            </span>
          ) : (
            <p className="text-xs text-muted-foreground">
              {saving ? "Saving..." : "All changes saved"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={saving || !isDirty} className="min-w-32 shadow-glow-primary">
            <Save className="mr-1.5 size-4" />
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Bot"}
          </Button>
        </div>
      </div>

    </form>
  );
}
