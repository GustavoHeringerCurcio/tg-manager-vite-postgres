import { Link, useLocation, useParams } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Plus, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import type { Bot as BotType } from "@/types";
import { api } from "@/lib/api";

export default function AppHeader({ onRefresh }: { onRefresh?: () => void }) {
  const { botId } = useParams<{ botId?: string }>();
  const location = useLocation();
  const { logout } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const [bot, setBot] = useState<BotType | null>(null);

  useEffect(() => {
    if (!botId) return;
    api.bots().then((bots) => {
      const found = bots.find((b) => b.id === botId);
      if (found) setBot(found);
    });
  }, [botId]);

  const pathParts = location.pathname.split("/").filter(Boolean);

  function pageLabel(segment: string): string {
    const labels: Record<string, string> = {
      manager: "Bots",
      new: "Create",
      dashboard: "Dashboard",
      messages: "Message Flow",
      remarketing: "Remarketing",
      transactions: "Transactions",
      interactions: "Interactions",
    };
    return labels[segment] || segment;
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger render={<SidebarTrigger />} />
          <TooltipContent>Toggle sidebar</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-5" />
        <Breadcrumb>
          <BreadcrumbList>
            {pathParts.map((part, i) => {
              const href = "/" + pathParts.slice(0, i + 1).join("/");
              const isLast = i === pathParts.length - 1;
              const label = part === botId && bot ? bot.name : pageLabel(part);

              return (
                <span key={href} className="flex items-center gap-1.5">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link to={href} />}>{label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  onRefresh?.();
                  window.dispatchEvent(new Event("botflix-refresh"));
                }}
              >
                <RefreshCw className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Refresh data</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            }
          />
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
        <Button variant="outline" size="sm" render={<Link to="/manager/new" />}>
          <Plus className="mr-1 size-4" />
          New Bot
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={logout}>
                <LogOut className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
