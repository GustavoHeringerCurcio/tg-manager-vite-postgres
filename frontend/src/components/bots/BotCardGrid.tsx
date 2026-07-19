import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Plus, Sparkles } from "lucide-react";

export default function BotCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-stagger">
      {children}
      <Link to="/manager/new" className="block">
        <Card className="group relative flex h-full min-h-[260px] flex-col items-center justify-center overflow-hidden border-dashed border-border/60 bg-muted/20 shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-card-hover hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
              <Plus className="size-6" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                Create New Bot
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground/60">
                <Sparkles className="size-3" />
                Deploy a new Telegram bot
              </p>
            </div>
          </div>
        </Card>
      </Link>
    </div>
  );
}
