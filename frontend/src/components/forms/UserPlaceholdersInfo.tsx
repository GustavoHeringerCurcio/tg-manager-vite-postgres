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
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">User Info</p>
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
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-emerald-400">{`{name:custom}`}</code>
              <span className="text-muted-foreground">Resolves to</span>
              <span className="text-foreground/80">user&apos;s first name, or your custom fallback (e.g., &quot;colega&quot;, &quot;amigo&quot;)</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 italic">
            Telegram always provides a first name, so the fallback is rarely needed.
          </p>

          <div className="border-t border-border/40 pt-3 mt-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Time & Compliments</p>
            <p className="text-xs text-muted-foreground mb-2">
              Configure time compliment presets in the Time Compliments section of bot settings.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2 text-xs">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-sky-400">{`{time}`}</code>
                <span className="text-muted-foreground">Resolves to</span>
                <span className="text-foreground/80">current time in HH:MM format (e.g., 07:45)</span>
              </div>
              <div className="flex items-baseline gap-2 text-xs">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-sky-400">{`{time_compliment_1}`}</code>
                <span className="text-muted-foreground">Resolves to</span>
                <span className="text-foreground/80">preset #1 label if time matches, or fallback text</span>
              </div>
              <div className="flex items-baseline gap-2 text-xs">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-sky-400">{`{time_compliment_2}`}</code>
                <span className="text-muted-foreground">Resolves to</span>
                <span className="text-foreground/80">preset #2 label if time matches, or fallback text</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 italic mt-2">
              Use 1-indexed numbers (1, 2, 3, ...) matching the order of presets in the Time Compliments editor.
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
