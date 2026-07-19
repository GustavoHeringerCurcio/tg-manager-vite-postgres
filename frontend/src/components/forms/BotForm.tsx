import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import MessageFlowEditor from "./MessageFlowEditor";
import RemarketingEditor from "./RemarketingEditor";
import type { Bot, BotPayload, RemarketingConfig, MessageStep } from "@/types";

const defaultRemarketing: RemarketingConfig = {
  enabled: false,
  intervalMs: 86400000,
  initialDelayMs: 0,
  maxSends: 0,
  messages: [],
};

interface BotFormProps {
  bot?: Bot | null;
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: BotPayload = {
      name,
      messageFlow,
      remarketing,
      checkoutAmount,
    };
    if (requireToken || token) payload.token = token;
    onSave(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <div>
          <Label className="text-sm uppercase tracking-wider text-muted-foreground">
            Bot Settings
          </Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bot-name">Bot Name</Label>
            <Input
              id="bot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {(requireToken || isEditing) && (
            <div className="space-y-2">
              <Label htmlFor="bot-token">
                Telegram Token {!requireToken && "(leave blank to keep current)"}
              </Label>
              <Input
                id="bot-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                required={requireToken}
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkout-amount">Checkout Amount (R$)</Label>
          <Input
            id="checkout-amount"
            type="number"
            min={0}
            step={0.01}
            value={checkoutAmount}
            onChange={(e) => setCheckoutAmount(Number(e.target.value))}
          />
        </div>
      </div>

      <Separator />

      <MessageFlowEditor steps={messageFlow} onChange={setMessageFlow} />

      <Separator />

      <RemarketingEditor config={remarketing} onChange={setRemarketing} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} className="min-w-32">
          {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Bot"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
