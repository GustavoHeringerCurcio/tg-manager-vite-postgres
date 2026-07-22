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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
  Wrench,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
    api
      .bots()
      .then(setBots)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/manager" />}
              className="px-2 py-4 data-active:!bg-transparent -ml-1"
            >
              <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover/menu-button:scale-105">
                <Bot className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold tracking-tight text-sm">
                  Botflix
                </span>
                <span className="text-xs text-sidebar-foreground/40">
                  Admin
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <div className="px-2 pb-0.5">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-start gap-2 h-8 rounded-md"
          render={<Link to="/manager/new" />}
        >
          <Plus className="size-4" />
          <span>New Bot</span>
        </Button>
      </div>

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
                <Bot />
                <span>All Bots</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Utils"
                isActive={location.pathname.startsWith("/utils")}
                render={<Link to="/utils/file-id" />}
              >
                <Wrench />
                <span>Utils</span>
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
                  isActive={
                    location.pathname === `/manager/${botId}/dashboard`
                  }
                  render={<Link to={`/manager/${botId}/dashboard`} />}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Settings"
                  isActive={
                    location.pathname === `/manager/${botId}/settings`
                  }
                  render={<Link to={`/manager/${botId}/settings`} />}
                >
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Message Flow"
                  isActive={isActive(`/manager/${botId}/messages`)}
                  render={<Link to={`/manager/${botId}/messages`} />}
                >
                  <Workflow />
                  <span>Message Flow</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Collapsible
                open={remarketingOpen}
                onOpenChange={setRemarketingOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger
                    render={<button className="w-full" />}
                  >
                    <SidebarMenuButton
                      tooltip="Remarketing"
                      isActive={isActive(
                        `/manager/${botId}/remarketing`
                      )}
                    >
                      <Timer />
                      <span>Remarketing</span>
                      <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={
                            location.pathname ===
                            `/manager/${botId}/remarketing`
                          }
                          render={
                            <Link
                              to={`/manager/${botId}/remarketing`}
                            />
                          }
                        >
                          Settings
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          isActive={
                            location.pathname ===
                            `/manager/${botId}/remarketing-status`
                          }
                          render={
                            <Link
                              to={`/manager/${botId}/remarketing-status`}
                            />
                          }
                        >
                          Status
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Transactions"
                  isActive={isActive(
                    `/manager/${botId}/transactions`
                  )}
                  render={<Link to={`/manager/${botId}/transactions`} />}
                >
                  <ArrowLeftRight />
                  <span>Transactions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Interactions"
                  isActive={isActive(
                    `/manager/${botId}/interactions`
                  )}
                  render={<Link to={`/manager/${botId}/interactions`} />}
                >
                  <MessageCircle />
                  <span>Interactions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Chat Preview"
                  isActive={
                    location.pathname ===
                    `/manager/${botId}/chat-preview`
                  }
                  render={
                    <Link to={`/manager/${botId}/chat-preview`} />
                  }
                >
                  <MessageSquare />
                  <span>Chat Preview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Payment Settings"
                  isActive={isActive(
                    `/manager/${botId}/payment-settings`
                  )}
                  render={
                    <Link to={`/manager/${botId}/payment-settings`} />
                  }
                >
                  <CreditCard />
                  <span>Payment Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>My Bots</SidebarGroupLabel>
          <SidebarMenu>
            <Collapsible
              open={botsOpen}
              onOpenChange={setBotsOpen}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger render={<button className="w-full" />}>
                  <SidebarMenuButton tooltip="Toggle bot list">
                    <ChevronDown className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                    <span>Bots</span>
                    <span className="ml-auto rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-sidebar-foreground/60">
                      {loading ? "..." : bots.length}
                    </span>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {loading ? (
                      <div className="space-y-1 px-1">
                        <Skeleton className="h-7 w-full" />
                        <Skeleton className="h-7 w-full" />
                      </div>
                    ) : bots.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-sidebar-foreground/50">
                        No bots yet
                      </p>
                    ) : (
                      bots.map((bot) => (
                        <SidebarMenuSubItem key={bot.id}>
                          <SidebarMenuSubButton
                            isActive={bot.id === botId}
                            render={
                              <Link
                                to={`/manager/${bot.id}/dashboard`}
                              />
                            }
                          >
                            <Avatar className="size-4 rounded-sm" size="sm">
                              {bot.photoUrl ? (
                                <AvatarImage
                                  src={bot.photoUrl}
                                  className="rounded-sm object-cover"
                                />
                              ) : null}
                              <AvatarFallback className="rounded-sm text-[9px]">
                                {bot.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{bot.name}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))
                    )}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border gap-1.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" className="h-auto py-2.5">
              <Avatar size="sm">
                <AvatarFallback className="text-[10px]">A</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">Admin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={
                theme === "dark" ? "Switch to light" : "Switch to dark"
              }
              onClick={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
              size="sm"
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
