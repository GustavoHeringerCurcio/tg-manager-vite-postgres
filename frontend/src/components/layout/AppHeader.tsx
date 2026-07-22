import { Link, useLocation, useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  CreditCard,
  User,
  Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Bots", href: "/manager" },
  { label: "Analytics", href: "/manager" },
  { label: "Settings", href: "/manager" },
];

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (href: string) =>
    href === "/manager" ? location.pathname === "/manager" : location.pathname.startsWith(href);

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex h-[var(--header-height)] items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="shrink-0" />
        <Link to="/manager" className="flex items-center gap-2 shrink-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </div>
          <span className="font-semibold tracking-tight text-sm">Botflix</span>
        </Link>
        <nav className="hidden md:flex items-center gap-0.5 ml-4">
          {navItems.map((item) => (
            <Button
              key={item.label}
              variant={isActive(item.href) ? "secondary" : "ghost"}
              size="sm"
              render={<Link to={item.href} />}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </div>

      <div className="hidden lg:flex flex-1 max-w-sm mx-4">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search bots..."
            className="h-8 pl-8 pr-3 text-xs bg-muted/50 border-transparent focus-visible:ring-0 focus-visible:border-border rounded-lg"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" className="relative">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary animate-pulse-dot" />
        </Button>

        <Button
          variant="default"
          size="xs"
          className="hidden sm:inline-flex"
          render={<Link to="/manager/new" />}
        >
          New Bot
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className={cn("flex items-center gap-2 pl-1.5 pr-2")}>
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px]">A</AvatarFallback>
                </Avatar>
                <ChevronDown className="size-3 text-muted-foreground hidden md:block" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/manager")}>
              <User />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/manager")}>
              <CreditCard />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/manager")}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} variant="destructive">
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
