import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Eye, EyeOff } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { MessageStep } from "@/types";
import { newStep } from "@/lib/helpers";
import { useUndo } from "@/hooks/useUndo";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import MessageStepCard from "./MessageStepCard";
import MessageFlowCsvDialog from "./MessageFlowCsvDialog";
import { UserPlaceholdersInfo } from "./UserPlaceholdersInfo";
import { StepNavigator } from "./StepNavigator";
import { MessagePreview } from "./MessagePreview";
import { toast } from "sonner";

interface MessageFlowEditorProps {
  steps: MessageStep[];
  onChange: (steps: MessageStep[]) => void;
}

export default function MessageFlowEditor({ steps: initialSteps, onChange }: MessageFlowEditorProps) {
  const { steps, push, undo, canUndo } = useUndo(initialSteps);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useKeyboardShortcuts({
    "mod+z": () => {
      const label = undo();
      if (label) {
        toast.success(`Undo: ${label}`);
        onChange(steps);
      }
    },
    "mod+shift+n": () => addStep(),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function commit(newSteps: MessageStep[], label?: string) {
    push(newSteps, label || "Step changed");
    onChange(newSteps);
  }

  function addStep() {
    const step = newStep(steps.length);
    const newSteps = [...steps, step];
    commit(newSteps, "Added step");
    setExpandedIndex(newSteps.length - 1);
  }

  function updateStep(index: number, step: MessageStep) {
    const updated = [...steps];
    updated[index] = step;
    commit(updated, `Updated step ${index + 1}`);
  }

  function removeStep(index: number) {
    const label = `Removed "${steps[index].title}"`;
    const filtered = steps.filter((_, i) => i !== index);
    commit(filtered, label);
    if (expandedIndex === index) setExpandedIndex(null);
    if (expandedIndex !== null && expandedIndex > index) setExpandedIndex(expandedIndex - 1);
  }

  function duplicateStep(index: number) {
    const copy = { ...steps[index], id: newStep().id, title: `${steps[index].title} (copy)` };
    const updated = [...steps];
    updated.splice(index + 1, 0, copy);
    commit(updated, "Duplicated step");
    setExpandedIndex(index + 1);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(steps, oldIndex, newIndex);
    commit(reordered, "Reordered steps");
    if (expandedIndex === oldIndex) setExpandedIndex(newIndex);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">Message Flow</Label>
          <p className="text-xs text-muted-foreground">{steps.length} step{steps.length !== 1 ? "s" : ""} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <MessageFlowCsvDialog
            steps={steps}
            onImport={(newSteps, mode) => {
              if (mode === "replace") {
                commit(newSteps, "Imported message flow");
              } else {
                commit([...steps, ...newSteps], "Appended from CSV");
              }
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="mr-1 size-3.5" /> Add Step
          </Button>
        </div>
      </div>

      {showPreview && (
        <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden animate-scale-in max-h-[500px]">
          <MessagePreview
            steps={steps}
            onClose={() => setShowPreview(false)}
          />
        </div>
      )}

      <UserPlaceholdersInfo />

      {steps.length === 0 ? (
        <button
          onClick={addStep}
          className="flex w-full flex-col items-center gap-3 py-10 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 transition-all"
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Plus className="size-5 text-muted-foreground/60" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Click to add the first step to your bot flow
            </p>
          </div>
        </button>
      ) : (
        <div className="space-y-4">
          <StepNavigator
            steps={steps}
            activeIndex={expandedIndex}
            onSelect={(i) => setExpandedIndex(i === expandedIndex ? null : i)}
          />

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={steps.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <MessageStepCard
                    key={step.id}
                    step={step}
                    index={i}
                    total={steps.length}
                    isExpanded={expandedIndex === i}
                    onToggle={(open) => setExpandedIndex(open ? i : null)}
                    onChange={(s) => updateStep(i, s)}
                    onRemove={() => removeStep(i)}
                    onDuplicate={() => duplicateStep(i)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {canUndo && (
            <p className="text-center text-[11px] text-muted-foreground/50">
              Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Ctrl+Z</kbd> to undo
            </p>
          )}
        </div>
      )}
    </div>
  );
}
