import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import MessageFlowEditor from "./MessageFlowEditor";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Settings, CreditCard } from "lucide-react";
import type { PaymentFlow, MessageStep } from "@/types";

interface PaymentFlowEditorProps {
  paymentFlow: PaymentFlow;
  onChange: (paymentFlow: PaymentFlow) => void;
}

const defaultPaymentFlow: PaymentFlow = {
  steps: [],
  verifyLabel: "Verificar pagamento",
  pixCopyLabel: "Copiar PIX",
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

      <CollapsibleSection
        title="Payment Messages"
        summary={`${flow.steps.length} step${flow.steps.length !== 1 ? "s" : ""}`}
        icon={<CreditCard className="size-4 text-amber-400" />}
        open={true}
        onOpenChange={() => {}}
      >
        <div className="pt-4">
          <MessageFlowEditor steps={flow.steps} onChange={handleStepsChange} />
        </div>
      </CollapsibleSection>
    </div>
  );
}
