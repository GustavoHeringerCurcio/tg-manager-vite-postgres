import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MessageFlowEditor from "./MessageFlowEditor";
import RemarketingEditor from "./RemarketingEditor";
import ButtonPresetsManager from "./ButtonPresetsManager";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import type { Bot as BotType, BotPayload, RemarketingConfig, MessageStep, LivePixResponse } from "@/types";
import { Settings, Save, Workflow, Timer } from "lucide-react";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const defaultRemarketing: RemarketingConfig = {
  enabled: false,
  intervalMs: 86400000,
  initialDelayMs: 0,
  maxSends: 0,
  messages: [],
};

interface BotFormProps {
  bot?: BotType | null;
  saving: boolean;
  onSave: (payload: BotPayload) => void;
  onCancel: () => void;
  requireToken?: boolean;
}

export default function BotForm({ bot, saving, onSave, onCancel, requireToken }: BotFormProps) {
  const isEditing = Boolean(bot);
  const [name, setName] = useState(bot?.name ?? "");
  const [token, setToken] = useState("");
  const [checkoutAmount, setCheckoutAmount] = useState(bot?.checkoutAmount ?? 0);
  const [messageFlow, setMessageFlow] = useState<MessageStep[]>(bot?.messageFlow ?? []);
  const [remarketing, setRemarketing] = useState<RemarketingConfig>(
    bot?.remarketing ?? defaultRemarketing
  );
  const [paymentFlow, setPaymentFlow] = useState<LivePixResponse[]>(bot?.paymentFlow ?? []);
  const [settingsOpen, setSettingsOpen] = useState(!isEditing);

  const initial = useMemo(() => ({
    name: bot?.name ?? "",
    messageFlow: bot?.messageFlow ?? [],
    remarketing: bot?.remarketing ?? defaultRemarketing,
    paymentFlow: bot?.paymentFlow ?? [],
    checkoutAmount: bot?.checkoutAmount ?? 0,
  }), [bot]);

  const current = {
    name,
    messageFlow,
    remarketing,
    paymentFlow,
    checkoutAmount,
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
      checkoutAmount,
    };
    if (requireToken || token) payload.token = token;
    onSave(payload);
  }

  const settingsSummary = [
    name && `"${name}"`,
    checkoutAmount > 0 && `R$ ${checkoutAmount.toFixed(2)}`,
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
          <div className="space-y-2">
            <Label htmlFor="checkout-amount" className="text-xs">Checkout Amount (R$)</Label>
            <Input
              id="checkout-amount"
              type="number"
              min={0}
              step={0.01}
              value={checkoutAmount}
              onChange={(e) => setCheckoutAmount(Number(e.target.value))}
              className="h-8"
            />
          </div>
        </div>
      </CollapsibleSection>

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
