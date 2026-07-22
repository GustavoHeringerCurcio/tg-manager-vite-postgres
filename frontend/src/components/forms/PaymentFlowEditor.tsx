import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import MessageFlowEditor from "./MessageFlowEditor";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Settings, CreditCard, Info, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { isLivepixConfigured } from "./LivepixSettings";
import type { PaymentFlow, MessageStep } from "@/types";

interface PaymentFlowEditorProps {
  paymentFlow: PaymentFlow;
  onChange: (paymentFlow: PaymentFlow) => void;
}

const defaultPaymentFlow: PaymentFlow = {
  steps: [],
  verifyLabel: "Verificar pagamento",
  pixCopyLabel: "Copiar PIX",
  unpaidAudioFileIds: [],
  verifyPaymentFailAudios: [],
  verifyPaymentSuccessAudios: [],
  isVerifyPaymentAudioEnabled: false,
  copyPixAudios: [],
  isCopyPixAudioEnabled: false,
};

export default function PaymentFlowEditor({ paymentFlow, onChange }: PaymentFlowEditorProps) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const flow = paymentFlow ?? defaultPaymentFlow;

  function update(fields: Partial<PaymentFlow>) {
    onChange({ ...flow, ...fields });
  }

  function handleStepsChange(steps: MessageStep[]) {
    update({ steps });
  }

  return (
    <div className="space-y-4">
      <CollapsibleSection
        title="Payment Settings"
        summary={`${flow.verifyLabel} · ${flow.pixCopyLabel}`}
        icon={<Settings className="size-4 text-muted-foreground" />}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      >
        <div className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="verify-label" className="text-xs">Verify Button Label</Label>
              <Input
                id="verify-label"
                value={flow.verifyLabel}
                onChange={(e) => update({ verifyLabel: e.target.value })}
                className="h-8"
                placeholder="Verificar pagamento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="copy-label" className="text-xs">Copy PIX Button Label</Label>
              <Input
                id="copy-label"
                value={flow.pixCopyLabel}
                onChange={(e) => update({ pixCopyLabel: e.target.value })}
                className="h-8"
                placeholder="Copiar PIX"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger
          render={
            <button className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-left transition-colors hover:bg-muted/30">
              <Info className="size-4 text-sky-400 shrink-0" />
              <span className="text-sm font-medium flex-1">Placeholders &amp; Toggles</span>
              <ChevronRight className="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
            </button>
          }
        />
        <CollapsibleContent className="pt-3 animate-fade-in">
          <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Placeholders</p>
              <p className="text-xs text-muted-foreground mb-2">
                Use these in step text fields to insert dynamic payment info.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{amount}`}</code>
                  <span className="text-muted-foreground">Resolves to</span>
                  <span className="text-foreground/80">R$ 29.90</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{pix_code}`}</code>
                  <span className="text-muted-foreground">Resolves to</span>
                  <span className="text-foreground/80">formatted monospace PIX code (tap to copy)</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{checkout_url}`}</code>
                  <span className="text-muted-foreground">Resolves to</span>
                  <span className="text-foreground/80">LivePix checkout link</span>
                </div>
              </div>
            </div>
            <div className="border-t border-border/40 pt-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">User Placeholders</p>
              <p className="text-xs text-muted-foreground mb-2">
                Personalize messages with the user&apos;s Telegram info.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{name}`}</code>
                  <span className="text-muted-foreground">Resolves to</span>
                  <span className="text-foreground/80">user&apos;s first name</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{name:custom}`}</code>
                  <span className="text-muted-foreground">Resolves to</span>
                  <span className="text-foreground/80">user&apos;s first name, or your custom fallback (e.g., &quot;colega&quot;, &quot;amigo&quot;)</span>
                </div>
              </div>
            </div>
            <div className="border-t border-border/40 pt-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Per‑step Toggles</p>
              <p className="text-xs text-muted-foreground mb-2">
                Enable on any step to inject payment elements at that position in the flow.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-emerald-400">QR Code ON</span>
                  <span className="text-muted-foreground">Sends a QR code photo right after this step</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-emerald-400">PIX Code ON</span>
                  <span className="text-muted-foreground">Appends formatted PIX code at the end of this step</span>
                </div>
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-medium text-emerald-400">LivePix Link ON</span>
                  <span className="text-muted-foreground">Appends checkout URL at the end of this step</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 italic">
              You can use both placeholders and toggles together in the same step.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <CollapsibleSection
        title="Payment Messages"
        summary={`${flow.steps.length} step${flow.steps.length !== 1 ? "s" : ""}`}
        icon={<CreditCard className="size-4 text-amber-400" />}
        open={true}
        onOpenChange={() => {}}
      >
        <div className="pt-4">
          <MessageFlowEditor steps={flow.steps} onChange={handleStepsChange} showPaymentOptions livepixConfigured={isLivepixConfigured(flow)} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
