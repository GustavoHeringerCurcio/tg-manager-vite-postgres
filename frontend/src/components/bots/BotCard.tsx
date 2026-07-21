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
  ArrowUpRight,
} from "lucide-react";
import { useState } from "react";
import type { Bot } from "@/types";

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
    <Card className="group relative flex flex-col shadow-sm transition-all duration-200 hover:shadow-card-hover hover:-translate-y-1 animate-fade-up">
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r from-primary/60 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />

      <Link to={`/manager/${bot.id}/dashboard`} className="flex flex-col flex-1 p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 rounded-xl ring-2 ring-border/50 group-hover:ring-primary/30 transition-all" size="lg">
              {bot.photoUrl ? (
                <AvatarImage src={bot.photoUrl} className="rounded-xl object-cover" />
              ) : null}
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold text-sm">
                {bot.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-sm leading-tight">{bot.name}</h3>
              <StatusBadge status={bot.status} />
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2 pt-3 border-t border-border/50">
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
      </Link>

      <div className="absolute top-3 right-3 flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          disabled={statusChanging}
          onClick={handleStatusToggle}
          title={bot.status === "ACTIVE" ? "Deactivate" : "Activate"}
        >
          {bot.status === "ACTIVE" ? (
            <PowerOff className="size-3.5 text-amber-400" />
          ) : (
            <Power className="size-3.5 text-emerald-400" />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
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
    </Card>
  );
}
