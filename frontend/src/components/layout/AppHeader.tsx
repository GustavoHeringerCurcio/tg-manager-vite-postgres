import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
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
import { RefreshCw, Plus, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import type { Bot as BotType } from "@/types";
import { api } from "@/lib/api";

export default function AppHeader() {
  const { botId } = useParams<{ botId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
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
      "payment-settings": "Payment Settings",
      livepix: "LivePix",
      "payment-buttons": "Payment Buttons",
      deliverables: "Deliverables",
    };
    return labels[segment] || segment;
  }

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b bg-background/80 backdrop-blur-xl px-3">
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger render={<SidebarTrigger />} />
          <TooltipContent side="bottom">Toggle sidebar (Ctrl+B)</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {pathParts.map((part, i) => {
              const href = "/" + pathParts.slice(0, i + 1).join("/");
              const isLast = i === pathParts.length - 1;
              const label = part === botId && bot ? bot.name : pageLabel(part);

              return (
                <span key={href} className="flex items-center gap-1">
                  {i > 0 && (
                    <BreadcrumbSeparator>
                      <ChevronRight className="size-3" />
                    </BreadcrumbSeparator>
                  )}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-medium">{label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        render={<Link to={href} />}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={() => navigate(0)}>
                <RefreshCw className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent side="bottom">Refresh data</TooltipContent>
        </Tooltip>
        <Button variant="default" size="xs" render={<Link to="/manager/new" />}>
          <Plus className="mr-1 size-3" />
          New Bot
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={logout}>
                <LogOut className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent side="bottom">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
