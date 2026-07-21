import { useParams, useNavigate } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, ChevronRight, AlertTriangle } from "lucide-react";
import { LIVEPIX_LOGO, isLivepixConfigured } from "@/components/forms/LivepixSettings";

export default function BotPaymentPage() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { bot, loading, error } = useBotDetail(botId);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-destructive">{error || "Bot not found"}</p>
      </div>
    );
  }

  const configured = isLivepixConfigured(bot.paymentFlow);

  return (
    <div className="space-y-6 animate-fade-in">
      {!configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">LivePix not configured</p>
            <p className="text-xs text-amber-300/70 mt-0.5">
              Payment buttons are disabled across your message flows until you set up at least one payment step.
              Click the LivePix card below to configure your payment flow.
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <Settings className="size-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Payment Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure payment gateways for {bot.name}
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => navigate(`/manager/${botId}/payment-settings/livepix`)}
          className="flex w-full items-center gap-4 rounded-xl border border-border/40 bg-card px-5 py-4 text-left shadow-sm hover:bg-muted/20 transition-colors"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-border/30 overflow-hidden">
            <img
              src={LIVEPIX_LOGO}
              alt="Livepix"
              className="size-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Livepix</span>
              {configured ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                  <span className="flex size-1.5 rounded-full bg-emerald-400" />
                  Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span className="flex size-1.5 rounded-full bg-muted-foreground/40" />
                  Not configured
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gateway for PIX payments via Livepix.gg
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
        </button>

        <button
          type="button"
          onClick={() => navigate(`/manager/${botId}/payment-settings/audio`)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/40 bg-card px-5 py-3 text-left shadow-sm hover:bg-muted/20 transition-colors"
        >
          <span className="text-sm font-medium">Gerenciar Áudios de Cobrança</span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground/50" />
        </button>
      </div>
    </div>
  );
}
