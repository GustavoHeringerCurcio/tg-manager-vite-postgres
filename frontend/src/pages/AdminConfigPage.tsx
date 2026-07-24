import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, ArrowLeft, Shield } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { GlobalConfig } from "@/types";

const DEFAULTS: GlobalConfig = {
  callbackCooldownMs: 7000,
  telegramRateLimit: 25,
  telegramRateBurst: 30,
  defaultMaxPixGenerations: 5,
  paymentPollWindowMinutes: 30,
  interactionRetentionDays: 90,
  userCacheTtlMs: 60000,
  userCacheMaxSize: 10000,
};

export default function AdminConfigPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<GlobalConfig>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.getGlobalConfig();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }

  function update(fields: Partial<GlobalConfig>) {
    setConfig((prev) => ({ ...prev, ...fields }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await api.updateGlobalConfig(config);
      setConfig(saved);
      toast.success("Global configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  function numberField(
    id: string,
    label: string,
    description: string,
    value: number,
    setter: (v: number) => void,
    placeholder?: string
  ) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-[11px] text-muted-foreground">{description}</p>
        <Input
          id={id}
          type="number"
          min={1}
          placeholder={placeholder ?? ""}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v > 0) setter(Math.round(v));
          }}
          className="h-9 text-sm max-w-[250px]"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => { setLoading(true); void loadConfig(); }}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/manager")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="size-5 text-muted-foreground" />
            Global Configuration
          </h1>
          <p className="text-sm text-muted-foreground">Application-wide settings</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">

          <h3 className="text-sm font-medium">Anti-spam & Rate Limiting</h3>

          {numberField(
            "callbackCooldownMs",
            "Callback cooldown (ms)",
            "Minimum delay between any two callback button clicks from the same Telegram user.",
            config.callbackCooldownMs,
            (v) => update({ callbackCooldownMs: v })
          )}

          {numberField(
            "telegramRateLimit",
            "Telegram API rate limit (msg/s)",
            "Maximum messages sent per second to Telegram API per bot.",
            config.telegramRateLimit,
            (v) => update({ telegramRateLimit: v })
          )}

          {numberField(
            "telegramRateBurst",
            "Telegram API rate burst",
            "Maximum burst of messages allowed before rate limiting kicks in.",
            config.telegramRateBurst,
            (v) => update({ telegramRateBurst: v })
          )}

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-medium mb-4">PIX / Payments</h3>

            {numberField(
              "defaultMaxPixGenerations",
              "Default max daily PIX generations",
              "Global default for per-user PIX code fetch limit. Can be overridden per bot.",
              config.defaultMaxPixGenerations,
              (v) => update({ defaultMaxPixGenerations: v })
            )}

            {numberField(
              "paymentPollWindowMinutes",
              "Payment poll window (minutes)",
              "How far back the payment poller looks for pending PIX transactions to confirm.",
              config.paymentPollWindowMinutes,
              (v) => update({ paymentPollWindowMinutes: v })
            )}
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-medium mb-4">Data Retention & Cache</h3>

            {numberField(
              "interactionRetentionDays",
              "Interaction retention (days)",
              "How long interaction logs are kept before automatic cleanup.",
              config.interactionRetentionDays,
              (v) => update({ interactionRetentionDays: v })
            )}

            {numberField(
              "userCacheTtlMs",
              "User cache TTL (ms)",
              "Time-to-live for the in-memory Telegram user cache. Lower values mean fresher data but more DB reads.",
              config.userCacheTtlMs,
              (v) => update({ userCacheTtlMs: v })
            )}

            {numberField(
              "userCacheMaxSize",
              "User cache max size",
              "Maximum number of users kept in the in-memory cache. Least recently used entries are evicted when exceeded.",
              config.userCacheMaxSize,
              (v) => update({ userCacheMaxSize: v })
            )}
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
