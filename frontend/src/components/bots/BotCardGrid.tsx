import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function BotCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
      <Link to="/manager/new" className="block">
        <Card className="flex h-full min-h-[280px] flex-col items-center justify-center border-dashed text-muted-foreground/70 shadow-card transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary hover:shadow-md">
          <Plus className="size-12" />
          <span className="mt-3 text-sm font-medium">Create New Bot</span>
        </Card>
      </Link>
    </div>
  );
}
