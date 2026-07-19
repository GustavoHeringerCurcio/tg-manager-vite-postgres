import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MoreHorizontal, Users, MessageSquare, CreditCard, Pencil, Trash2, Power, PowerOff } from "lucide-react";
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

  return (
    <Card className="group relative transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <Link to={`/manager/${bot.id}/dashboard`} className="block">
        <CardHeader className="text-center">
          <Avatar className="mx-auto size-16">
            <AvatarFallback className="text-lg font-semibold bg-primary/15 text-primary">
              {bot.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="mt-2 text-lg">{bot.name}</CardTitle>
          <StatusBadge status={bot.status} />
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary/60" />
              <span className="text-muted-foreground">{stats?.totalUsers?.toLocaleString() ?? "—"} Users</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary/60" />
              <span className="text-muted-foreground">{stats?.messageCount?.toLocaleString() ?? "—"} Messages</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary/60" />
              <span className="text-muted-foreground">R$ {(bot.checkoutAmount || 0).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Link>
      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                window.location.href = `/manager/${bot.id}/messages`;
              }}
            >
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
                    className="text-destructive"
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
