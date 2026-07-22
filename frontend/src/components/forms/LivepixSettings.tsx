import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Info, ChevronDown, Smartphone, CreditCard } from "lucide-react";
import type { PaymentFlow } from "@/types";
import MessageFlowEditor from "./MessageFlowEditor";

export const LIVEPIX_LOGO =
  "https://play-lh.googleusercontent.com/e061VhzWGsmeXKZVjuR6vqcQisXpHA6zhJm4HyTXWLxefkM8vsSYnRemtYod8r_oeuAwJCMtZj7ELJbTRM_rClo";

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
  deliverables: [],
};

export function isLivepixConfigured(paymentFlow: PaymentFlow): boolean {
  const flow = paymentFlow ?? defaultPaymentFlow;
  return (
    flow.steps.length > 0 ||
    flow.verifyLabel !== defaultPaymentFlow.verifyLabel ||
    flow.pixCopyLabel !== defaultPaymentFlow.pixCopyLabel
  );
}

interface LivepixSettingsProps {
  paymentFlow: PaymentFlow;
  onChange: (paymentFlow: PaymentFlow) => void;
}

export default function LivepixSettings({ paymentFlow, onChange }: LivepixSettingsProps) {
  const [buttonSettingsOpen, setButtonSettingsOpen] = useState(true);
  const flow = paymentFlow;

  function update(fields: Partial<PaymentFlow>) {
    onChange({ ...flow, ...fields });
  }

  return (
    <div className="space-y-4">
      

      <PlaceholdersInfo />

      <CollapsibleSection
        title="Payment Messages"
        summary={`${flow.steps.length} step${flow.steps.length !== 1 ? "s" : ""}`}
        icon={<CreditCard className="size-4 text-amber-400" />}
        open={true}
        onOpenChange={() => {}}
      >
        <div className="pt-4">
          <MessageFlowEditor steps={flow.steps} onChange={(steps) => update({ steps })} showPaymentOptions livepixConfigured={isLivepixConfigured(flow)} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Last Message Buttons"
        summary={`"${flow.verifyLabel}" · "${flow.pixCopyLabel}"`}
        icon={<Smartphone className="size-4 text-muted-foreground" />}
        open={buttonSettingsOpen}
        onOpenChange={setButtonSettingsOpen}
      >
        <div className="space-y-5 pt-4">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Telegram Preview
            </p>

            <div className="max-w-xs mx-auto">
              <div className="rounded-xl border border-border/40 bg-background px-3 pt-2.5 pb-3 shadow-sm">
                <div className="flex items-start gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                    B
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-sky-500">
                      Botflix Bot
                    </span>
                  </div>
                </div>

                <div className="mt-2 rounded-xl bg-muted/40 px-3 py-2">
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    Seu pagamento est&aacute; sendo processado...
                  </p>
                </div>

                <div className="mt-2.5 flex gap-1.5">
                  <div className="flex-1 rounded-lg bg-sky-500 px-1.5 py-2 text-center">
                    <span className="text-[11px] font-medium text-white break-all leading-tight">
                      {flow.verifyLabel}
                    </span>
                  </div>
                  <div className="flex-1 rounded-lg bg-green-500 px-1.5 py-2 text-center">
                    <span className="text-[11px] font-medium text-white break-all leading-tight">
                      {flow.pixCopyLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60 text-center mt-3 italic">
              These two buttons appear in the last message of your payment flow
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="verify-label" className="text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded bg-sky-500 text-[9px] font-bold text-white">
                    &#x2713;
                  </span>
                  Verify Button
                </span>
              </Label>
              <Input
                id="verify-label"
                value={flow.verifyLabel}
                onChange={(e) => update({ verifyLabel: e.target.value })}
                className="h-9 text-sm"
                placeholder="Verificar pagamento"
              />
              <p className="text-[10px] text-muted-foreground/60">
                Sent so the user can confirm their payment was made
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="copy-label" className="text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded bg-green-500 text-[9px] font-bold text-white">
                    &#x1F4CB;
                  </span>
                  Copy PIX Button
                </span>
              </Label>
              <Input
                id="copy-label"
                value={flow.pixCopyLabel}
                onChange={(e) => update({ pixCopyLabel: e.target.value })}
                className="h-9 text-sm"
                placeholder="Copiar PIX"
              />
              <p className="text-[10px] text-muted-foreground/60">
                Sent so the user can copy the PIX code to their clipboard
              </p>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function PlaceholdersInfo() {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-left transition-colors hover:bg-muted/30">
            <Info className="size-4 text-sky-400 shrink-0" />
            <span className="text-sm font-medium flex-1">Placeholders &amp; Toggles</span>
            <ChevronDown className="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
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
  );
}
