import { cn } from "@/lib/utils";
import type { MessageStep, MessageType } from "@/types";

const typeIcons: Record<MessageType, string> = {
  TEXT: "T",
  AUDIO: "A",
  VIDEO: "V",
  IMAGE: "I",
};

const typeColors: Record<MessageType, string> = {
  TEXT: "bg-secondary text-muted-foreground",
  AUDIO: "bg-amber-500/20 text-amber-400",
  VIDEO: "bg-violet-500/20 text-violet-400",
  IMAGE: "bg-emerald-500/20 text-emerald-400",
};

interface StepNavigatorProps {
  steps: MessageStep[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}

export function StepNavigator({ steps, activeIndex, onSelect }: StepNavigatorProps) {
  if (steps.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
      {steps.map((step, i) => (
        <button
          key={step.id}
          onClick={() => onSelect(i)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
            i === activeIndex
              ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
              : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-full text-[9px] font-bold",
              i === activeIndex ? "bg-primary text-primary-foreground" : typeColors[step.type]
            )}
          >
            {i === activeIndex ? i + 1 : typeIcons[step.type]}
          </span>
          <span className="truncate max-w-[100px]">{step.title}</span>
        </button>
      ))}
    </div>
  );
}
