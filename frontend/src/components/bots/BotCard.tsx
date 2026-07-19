import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  CreditCard,
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

export default function BotCard({ bot, stats, onStatusChange, onDelete }: BotCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Card className="group relative flex flex-col shadow-sm transition-all duration-200 hover:shadow-card-hover hover:-translate-y-1 animate-fade-up">
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r from-primary/60 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />

      <Link to={`/manager/${bot.id}/dashboard`} className="flex flex-col flex-1 p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 rounded-xl ring-2 ring-border/50 group-hover:ring-primary/30 transition-all" size="lg">
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
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums leading-none">
              R$ {(bot.checkoutAmount || 0).toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <CreditCard className="size-2.5" />
              Price
            </p>
          </div>
        </div>
      </Link>

      <div className="absolute top-3 right-3">
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
            <DropdownMenuItem
              onSelect={() =>
                onStatusChange(bot.id, bot.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")
              }
            >
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
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
                  <DialogDescription>
                    Are you sure you want to delete <strong>{bot.name}</strong>? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDelete(bot.id);
                      setDeleteOpen(false);
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
