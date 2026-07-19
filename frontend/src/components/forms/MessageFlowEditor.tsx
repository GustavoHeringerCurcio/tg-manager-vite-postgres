import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import type { MessageStep } from "@/types";
import { newStep } from "@/lib/helpers";
import MessageStepCard from "./MessageStepCard";

interface MessageFlowEditorProps {
  steps: MessageStep[];
  onChange: (steps: MessageStep[]) => void;
}

export default function MessageFlowEditor({ steps, onChange }: MessageFlowEditorProps) {
  function addStep() {
    onChange([...steps, newStep(steps.length)]);
  }

  function updateStep(index: number, step: MessageStep) {
    const updated = [...steps];
    updated[index] = step;
    onChange(updated);
  }

  function removeStep(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  function duplicateStep(index: number) {
    const copy = { ...steps[index], id: newStep().id, title: `${steps[index].title} (copy)` };
    const updated = [...steps];
    updated.splice(index + 1, 0, copy);
    onChange(updated);
  }

  function moveStep(from: number, to: number) {
    if (to < 0 || to >= steps.length) return;
    const updated = [...steps];
    const [removed] = updated.splice(from, 1);
    updated.splice(to, 0, removed);
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Message Flow ({steps.length} steps)</Label>
        <Button variant="outline" size="sm" onClick={addStep}>
          <Plus className="mr-1 size-4" /> Add Step
        </Button>
      </div>
      {steps.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No messages yet. Add the first step to your bot flow.
        </p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <MessageStepCard
              key={step.id}
              step={step}
              index={i}
              total={steps.length}
              onChange={(s) => updateStep(i, s)}
              onRemove={() => removeStep(i)}
              onDuplicate={() => duplicateStep(i)}
              onMoveUp={i > 0 ? () => moveStep(i, i - 1) : undefined}
              onMoveDown={i < steps.length - 1 ? () => moveStep(i, i + 1) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
