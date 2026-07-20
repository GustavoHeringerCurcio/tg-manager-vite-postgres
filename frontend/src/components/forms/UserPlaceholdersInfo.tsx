import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Info, ChevronDown } from "lucide-react";

export function UserPlaceholdersInfo() {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger
        render={
          <button className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 text-left transition-colors hover:bg-muted/30">
            <Info className="size-4 text-sky-400 shrink-0" />
            <span className="text-sm font-medium flex-1">User Placeholders</span>
            <ChevronDown className="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        }
      />
      <CollapsibleContent className="pt-3 animate-fade-in">
        <div className="rounded-lg border border-border/50 bg-card p-4 space-y-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Placeholders</p>
          <p className="text-xs text-muted-foreground mb-2">
            Use these in step text fields to personalize messages with the user&apos;s Telegram info.
          </p>
          <div className="space-y-1.5">
            <div className="flex items-baseline gap-2 text-xs">
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{name}`}</code>
              <span className="text-muted-foreground">Resolves to</span>
              <span className="text-foreground/80">user&apos;s first name</span>
            </div>
            <div className="flex items-baseline gap-2 text-xs">
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{name:Friend}`}</code>
              <span className="text-muted-foreground">Resolves to</span>
              <span className="text-foreground/80">user&apos;s first name or &quot;Friend&quot; if unavailable</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 italic">
            Telegram always provides a first name, so the fallback is rarely needed.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
