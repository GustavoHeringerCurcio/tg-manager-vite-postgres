import { Link, useLocation, useParams } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Bot,
  LayoutDashboard,
  MessageCircle,
  ArrowLeftRight,
  Plus,
  Timer,
  Workflow,
  ChevronDown,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useEffect, useState } from "react";
import type { Bot as BotType } from "@/types";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppSidebar() {
  const { botId } = useParams<{ botId?: string }>();
  const location = useLocation();
  const [bots, setBots] = useState<BotType[]>([]);
  const [loading, setLoading] = useState(true);
  const [botsOpen, setBotsOpen] = useState(true);

  useEffect(() => {
    api.bots().then(setBots).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/manager" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">Botflix</span>
                <span className="text-xs text-muted-foreground">Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="All Bots"
                isActive={location.pathname === "/manager"}
                render={<Link to="/manager" />}
              >
                <Bot className="size-4" />
                <span>All Bots</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {botId && (
          <SidebarGroup>
            <SidebarGroupLabel>Current Bot</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Dashboard"
                  isActive={location.pathname === `/manager/${botId}/dashboard`}
                  render={<Link to={`/manager/${botId}/dashboard`} />}
                >
                  <LayoutDashboard className="size-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Message Flow"
                  isActive={location.pathname.startsWith(`/manager/${botId}/messages`)}
                  render={<Link to={`/manager/${botId}/messages`} />}
                >
                  <Workflow className="size-4" />
                  <span>Message Flow</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Remarketing"
                  isActive={location.pathname.startsWith(`/manager/${botId}/remarketing`)}
                  render={<Link to={`/manager/${botId}/remarketing`} />}
                >
                  <Timer className="size-4" />
                  <span>Remarketing</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Transactions"
                  isActive={location.pathname.startsWith(`/manager/${botId}/transactions`)}
                  render={<Link to={`/manager/${botId}/transactions`} />}
                >
                  <ArrowLeftRight className="size-4" />
                  <span>Transactions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Interactions"
                  isActive={location.pathname.startsWith(`/manager/${botId}/interactions`)}
                  render={<Link to={`/manager/${botId}/interactions`} />}
                >
                  <MessageCircle className="size-4" />
                  <span>Interactions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>My Bots</SidebarGroupLabel>
          <SidebarMenu>
            <Collapsible open={botsOpen} onOpenChange={setBotsOpen} className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger render={<button className="w-full" />}>
                  <SidebarMenuButton tooltip="Toggle bot list">
                    <ChevronDown className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    <span>Bots ({loading ? "..." : bots.length})</span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 space-y-0.5">
                    {loading ? (
                      <>
                        <Skeleton className="h-7 w-full" />
                        <Skeleton className="h-7 w-full" />
                      </>
                    ) : bots.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-muted-foreground">No bots yet</p>
                    ) : (
                      bots.map((bot) => (
                        <SidebarMenuButton
                          key={bot.id}
                          isActive={bot.id === botId}
                          size="sm"
                          tooltip={bot.name}
                          render={<Link to={`/manager/${bot.id}/dashboard`} />}
                        >
                          <span className="truncate">{bot.name}</span>
                        </SidebarMenuButton>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Create New Bot" render={<Link to="/manager/new" />}>
              <Plus className="size-4" />
              <span>Create New Bot</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
