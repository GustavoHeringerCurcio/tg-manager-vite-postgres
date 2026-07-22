import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import {
  MoreHorizontal,
  Users,
  MessageSquare,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Calendar,
  Settings,
} from "lucide-react";
import { useState } from "react";
import type { Bot } from "@/types";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

interface BotCardProps {
  bot: Bot;
  stats?: {
    totalUsers: number;
    totalInteractions: number;
    checkoutClicks: number;
    messageCount: number;
  };
  onStatusChange: (id: string, newStatus: "ACTIVE" | "INACTIVE") => void;
  onDelete: (id: string) => void;
}

const DELETE_PHRASE = "delete my bot ";

export default function BotCard({ bot, stats, onStatusChange, onDelete }: BotCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [statusChanging, setStatusChanging] = useState(false);
  const navigate = useNavigate();

  const requiredText = DELETE_PHRASE + bot.name;
  const isActive = bot.status === "ACTIVE";
  const isSuspended = bot.status === "SUSPENDED";

  async function handleStatusToggle() {
    setStatusChanging(true);
    try {
      const newStatus = isActive ? "INACTIVE" : "ACTIVE";
      onStatusChange(bot.id, newStatus);
    } finally {
      setStatusChanging(false);
    }
  }

  const avatarRing = cn(
    "!size-24 rounded-2xl ring-2 shadow-md shrink-0 transition-all duration-200 group-hover:scale-105 group-hover:shadow-lg",
    isActive &&
      "ring-emerald-500/30 shadow-emerald-500/10 group-hover:ring-emerald-500/50 group-hover:shadow-emerald-500/20",
    isSuspended &&
      "ring-destructive/30 shadow-destructive/10 group-hover:ring-destructive/50 group-hover:shadow-destructive/20",
    !isActive && !isSuspended &&
      "ring-border shadow-transparent group-hover:ring-muted-foreground/30"
  );

  return (
    <Card className="group relative flex flex-col aspect-square !p-0 shadow-sm transition-all duration-200 hover:shadow-card-hover hover:-translate-y-1 animate-fade-up">
      {/* ---- accent bar ---- */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 rounded-t-xl z-10 bg-gradient-to-r pointer-events-none",
          isActive && "from-emerald-500/60 to-emerald-500/5",
          isSuspended && "from-destructive/60 to-destructive/5",
          !isActive && !isSuspended && "from-border to-transparent",
        )}
      />

      {/* ---- action buttons ---- */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 z-20">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground/50 hover:text-foreground transition-colors"
          disabled={statusChanging}
          onClick={handleStatusToggle}
          title={isActive ? "Deactivate" : "Activate"}
        >
          {isActive ? (
            <PowerOff className="size-3.5 text-amber-500" />
          ) : (
            <Power className="size-3.5 text-emerald-500" />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => navigate(`/manager/${bot.id}/messages`)}>
              <Pencil className="mr-2 size-4" />
              Edit Messages
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/manager/${bot.id}/settings`)}>
              <Settings className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleStatusToggle}>
              {isActive ? (
                <>
                  <PowerOff className="mr-2 size-4" /> Deactivate
                </>
              ) : (
                <>
                  <Power className="mr-2 size-4" /> Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) setDeleteConfirmText("");
              }}
            >
              <DialogTrigger
                render={
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Bot</DialogTitle>
                  <DialogDescription className="space-y-3 pt-2">
                    <p>
                      This action <strong>cannot be undone</strong>. All data
                      including users, messages, transactions, and sessions will be
                      permanently deleted.
                    </p>
                    <p className="text-destructive font-medium">
                      Type{" "}
                      <code className="px-1 py-0.5 rounded bg-muted text-destructive text-xs font-mono">
                        {requiredText}
                      </code>{" "}
                      to confirm:
                    </p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={requiredText}
                      className="h-9 font-mono text-sm"
                      autoFocus
                    />
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeleteConfirmText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleteConfirmText !== requiredText}
                    onClick={() => {
                      onDelete(bot.id);
                      setDeleteOpen(false);
                      setDeleteConfirmText("");
                    }}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ---- main content ---- */}
      <Link
        to={`/manager/${bot.id}/dashboard`}
        className="flex flex-col items-center h-full px-4 pt-5"
      >
        {/* centered avatar */}
        <div className="flex-1 flex items-center justify-center w-full pb-3">
          <Avatar className={avatarRing}>
            {bot.photoUrl ? (
              <AvatarImage
                src={bot.photoUrl}
                className="rounded-2xl object-cover"
              />
            ) : null}
            <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-bold text-4xl">
              {bot.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* name */}
        <h3 className="font-semibold text-sm leading-tight truncate max-w-full">
          {bot.name}
        </h3>

        {/* status */}
        <div className="mt-1">
          <StatusBadge status={bot.status} />
        </div>

        {/* date */}
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Calendar className="size-2.5" />
          {relativeTime(bot.createdAt)}
        </p>

        {/* stats footer */}
        <div className="w-full mt-2.5 border-t border-border/40 bg-muted/30 -mx-4 px-4 py-2.5">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums leading-none">
                {stats?.totalUsers?.toLocaleString() ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <Users className="size-3" />
                Users
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums leading-none">
                {stats?.messageCount?.toLocaleString() ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <MessageSquare className="size-3" />
                Msgs
              </p>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
}
