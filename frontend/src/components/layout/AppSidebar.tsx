import { Link, useLocation, useParams } from "react-router-dom";
import { useTheme } from "next-themes";
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
  Sun,
  Moon,
  CreditCard,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import type { Bot as BotType } from "@/types";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppSidebar() {
  const { botId } = useParams<{ botId?: string }>();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [bots, setBots] = useState<BotType[]>([]);
  const [loading, setLoading] = useState(true);
  const [botsOpen, setBotsOpen] = useState(true);
  const [remarketingOpen, setRemarketingOpen] = useState(true);

  useEffect(() => {
    api.bots().then(setBots).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="relative overflow-hidden border-b border-sidebar-border px-0 py-0">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/manager" />} className="relative px-3 py-5">
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover/menu-button:scale-105">
                <Bot className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold tracking-tight">Botflix</span>
                <span className="text-xs text-sidebar-foreground/40">Admin</span>
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
                  <LayoutDashboard className="size-4 text-sky-400" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Settings"
                  isActive={location.pathname === `/manager/${botId}/settings`}
                  render={<Link to={`/manager/${botId}/settings`} />}
                >
                  <Settings className="size-4 text-slate-400" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Message Flow"
                  isActive={isActive(`/manager/${botId}/messages`)}
                  render={<Link to={`/manager/${botId}/messages`} />}
                >
                  <Workflow className="size-4 text-emerald-400" />
                  <span>Message Flow</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Collapsible open={remarketingOpen} onOpenChange={setRemarketingOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger render={<button className="w-full" />}>
                    <SidebarMenuButton
                      tooltip="Remarketing"
                      isActive={isActive(`/manager/${botId}/remarketing`)}
                    >
                      <Timer className="size-4 text-amber-400" />
                      <span>Remarketing</span>
                      <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 space-y-0.5 animate-fade-in">
                      <SidebarMenuButton
                        isActive={location.pathname === `/manager/${botId}/remarketing`}
                        size="sm"
                        render={<Link to={`/manager/${botId}/remarketing`} />}
                      >
                        <span>Settings</span>
                      </SidebarMenuButton>
                      <SidebarMenuButton
                        isActive={location.pathname === `/manager/${botId}/remarketing-status`}
                        size="sm"
                        render={<Link to={`/manager/${botId}/remarketing-status`} />}
                      >
                        <span>Status</span>
                      </SidebarMenuButton>
                    </div>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Transactions"
                  isActive={isActive(`/manager/${botId}/transactions`)}
                  render={<Link to={`/manager/${botId}/transactions`} />}
                >
                  <ArrowLeftRight className="size-4 text-violet-400" />
                  <span>Transactions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Interactions"
                  isActive={isActive(`/manager/${botId}/interactions`)}
                  render={<Link to={`/manager/${botId}/interactions`} />}
                >
                  <MessageCircle className="size-4 text-rose-400" />
                  <span>Interactions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Chat Preview"
                  isActive={location.pathname === `/manager/${botId}/chat-preview`}
                  render={<Link to={`/manager/${botId}/chat-preview`} />}
                >
                  <MessageSquare className="size-4 text-cyan-400" />
                  <span>Chat Preview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Payment Settings"
                  isActive={isActive(`/manager/${botId}/payment-settings`)}
                  render={<Link to={`/manager/${botId}/payment-settings`} />}
                >
                  <CreditCard className="size-4 text-emerald-400" />
                  <span>Payment Settings</span>
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
                    <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    <span>Bots</span>
                    <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-sidebar-foreground/60">
                      {loading ? "..." : bots.length}
                    </span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 space-y-0.5 animate-fade-in">
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
                          <Avatar className="size-4 rounded-sm" size="sm">
                            {bot.photoUrl ? (
                              <AvatarImage src={bot.photoUrl} className="rounded-sm object-cover" />
                            ) : null}
                            <AvatarFallback className="rounded-sm text-[9px]">{bot.name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
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
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={theme === "dark" ? "Switch to light" : "Switch to dark"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="size-4 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="size-4 text-sky-400" />
                  <span>Dark Mode</span>
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Create New Bot" render={<Link to="/manager/new" />}>
              <div className="flex size-4 items-center justify-center rounded bg-primary/20">
                <Plus className="size-3 text-primary" />
              </div>
              <span>Create New Bot</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
