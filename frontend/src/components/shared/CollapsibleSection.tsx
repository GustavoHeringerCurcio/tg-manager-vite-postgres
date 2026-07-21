import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  summary?: string;
  icon?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirty?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  summary,
  icon,
  open,
  onOpenChange,
  dirty = false,
  children,
  className,
}: CollapsibleSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className={cn("rounded-xl border border-border/40 bg-card shadow-sm", className)}>
        <CollapsibleTrigger
          render={
            <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors rounded-t-xl data-[state=closed]:rounded-b-xl">
              {icon && (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{title}</span>
                  {dirty && (
                    <span className="flex size-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
                  )}
                </div>
                {!open && summary && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{summary}</p>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            </button>
          }
        />
        <CollapsibleContent keepMounted>
          <div className="px-5 pb-5 pt-0 border-t border-border/40">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
