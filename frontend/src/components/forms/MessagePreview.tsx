import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MessageStep, MessageType } from "@/types";
import { cn } from "@/lib/utils";

interface MessagePreviewProps {
  steps: MessageStep[];
  botName?: string;
  onClose: () => void;
}

const typeLabel: Record<MessageType, string> = {
  TEXT: "Text",
  AUDIO: "Audio",
  VIDEO: "Video",
};

const colorMap: Record<string, string> = {
  BLUE: "bg-blue-500",
  GREEN: "bg-emerald-500",
  RED: "bg-red-500",
};

export function MessagePreview({ steps, botName = "Bot", onClose }: MessagePreviewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div>
          <h3 className="text-sm font-semibold">Preview</h3>
          <p className="text-xs text-muted-foreground">How users see your bot</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4 bg-muted/30 scrollbar-thin">
        <div className="text-center">
          <Badge variant="secondary" className="text-[10px]">
            {new Date().toLocaleDateString()}
          </Badge>
        </div>

        {steps.map((step, i) => (
          <div key={step.id} className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold mt-1">
                {botName.charAt(0)}
              </div>
              <div className="flex-1 max-w-[85%]">
                <div className="rounded-2xl rounded-tl-md bg-card border border-border/30 px-4 py-2.5 shadow-sm">
                  {(step.type === "TEXT" || step.type === "VIDEO" || step.type === "AUDIO") && step.text && (
                    <p className="text-sm whitespace-pre-wrap">{step.text}</p>
                  )}

                  {step.mediaUrls.length > 0 && step.type !== "TEXT" && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md",
                          step.type === "AUDIO" ? "bg-amber-500/20 text-amber-400" : "bg-violet-500/20 text-violet-400"
                        )}
                      >
                        {step.type === "AUDIO" ? "🎵" : "🎬"}
                      </div>
                      <div>
                        <p className="font-medium">{typeLabel[step.type]}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {step.mediaUrls.length} file{step.mediaUrls.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {step.buttons.length > 0 && !(step.type === "VIDEO" && step.mediaUrls.length > 1) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {step.buttons.map((btn) => (
                        <span
                          key={btn.id}
                          className={cn(
                            "inline-block rounded-lg px-3 py-1.5 text-xs font-medium text-white",
                            colorMap[btn.color] || "bg-blue-500"
                          )}
                        >
                          {btn.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {step.delayMs > 0 && (
              <div className="flex justify-center">
                <span className="text-[10px] text-muted-foreground/50">
                  {Math.round(step.delayMs / 1000)}s delay
                </span>
              </div>
            )}
          </div>
        ))}

        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm">No messages configured</p>
            <p className="text-xs mt-1">Add steps to see a preview</p>
          </div>
        )}
      </div>
    </div>
  );
}
