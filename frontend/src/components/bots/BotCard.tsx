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
import {
  MoreHorizontal,
  Users,
  MessageSquare,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Calendar,
} from "lucide-react";
import { useState } from "react";
import type { Bot, BotStatus } from "@/types";

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

const statusAccent: Record<BotStatus, { gradient: string; ring: string; ringHover: string; glow: string; glowHover: string }> = {
  ACTIVE: {
    gradient: "from-emerald-500/50 to-emerald-500/5",
    ring: "ring-emerald-500/20",
    ringHover: "ring-emerald-500/40",
    glow: "bg-emerald-500/5",
    glowHover: "bg-emerald-500/15",
  },
  INACTIVE: {
    gradient: "from-border to-transparent",
    ring: "ring-border",
    ringHover: "ring-muted-foreground/30",
    glow: "bg-muted-foreground/5",
    glowHover: "bg-muted-foreground/10",
  },
  SUSPENDED: {
    gradient: "from-destructive/50 to-destructive/5",
    ring: "ring-destructive/20",
    ringHover: "ring-destructive/40",
    glow: "bg-destructive/5",
    glowHover: "bg-destructive/15",
  },
};

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
  const accent = statusAccent[bot.status];

  async function handleStatusToggle() {
    setStatusChanging(true);
    try {
      const newStatus = bot.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      onStatusChange(bot.id, newStatus);
    } finally {
      setStatusChanging(false);
    }
  }

  return (
    <Card className="group relative flex flex-col aspect-square shadow-sm transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 animate-fade-up">
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r ${accent.gradient}`} />

      <div className="absolute top-3 right-3 flex items-center gap-0.5 z-10">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground/50 hover:text-foreground transition-colors"
          disabled={statusChanging}
          onClick={handleStatusToggle}
          title={bot.status === "ACTIVE" ? "Deactivate" : "Activate"}
        >
          {bot.status === "ACTIVE" ? (
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
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => navigate(`/manager/${bot.id}/messages`)}>
              <Pencil className="mr-2 size-4" />
              Edit Messages
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleStatusToggle}>
              {bot.status === "ACTIVE" ? (
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
            <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirmText(""); }}>
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
                      This action <strong>cannot be undone</strong>. All data including users, messages, transactions, and sessions will be permanently deleted.
                    </p>
                    <p className="text-destructive font-medium">
                      Type <code className="px-1 py-0.5 rounded bg-muted text-destructive text-xs font-mono">{requiredText}</code> to confirm:
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
                  <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirmText(""); }}>Cancel</Button>
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

      <Link
        to={`/manager/${bot.id}/dashboard`}
        className="flex flex-col items-center justify-center flex-1 px-4 py-4"
      >
        <div className="relative mb-5">
          <div className={`absolute -inset-4 rounded-3xl blur-xl transition-all duration-300 ${accent.glow} group-hover:${accent.glowHover}`} />
          <Avatar className={`relative size-28 rounded-2xl ring-2 transition-all duration-300 ${accent.ring} group-hover:${accent.ringHover} group-hover:scale-105`} size="lg">
            {bot.photoUrl ? (
              <AvatarImage src={bot.photoUrl} className="rounded-2xl object-cover" />
            ) : null}
            <AvatarFallback className="rounded-2xl bg-primary/10 text-primary font-bold text-3xl">
              {bot.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <h3 className="font-semibold text-base leading-tight truncate max-w-full">
          {bot.name}
        </h3>

        <div className="mt-1">
          <StatusBadge status={bot.status} />
        </div>

        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Calendar className="size-2.5" />
          {relativeTime(bot.createdAt)}
        </p>

        <div className="mt-auto w-full">
          <div className="mb-3 border-t border-border/40" />
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums leading-none">
                {stats?.totalUsers?.toLocaleString() ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <Users className="size-2.5" />
                Users
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums leading-none">
                {stats?.messageCount?.toLocaleString() ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <MessageSquare className="size-2.5" />
                Msgs
              </p>
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
}
