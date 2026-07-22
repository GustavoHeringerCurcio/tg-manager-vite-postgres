import { useParams, useNavigate } from "react-router-dom";
import { useBotDetail } from "@/hooks/useBotDetail";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, ArrowLeft, Settings } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { BotSettings } from "@/types";

const TIMEZONES = [
  { value: "", label: "None (server default)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (UTC-3)" },
  { value: "America/New_York", label: "America/New_York (UTC-5)" },
  { value: "America/Chicago", label: "America/Chicago (UTC-6)" },
  { value: "America/Denver", label: "America/Denver (UTC-7)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8)" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires (UTC-3)" },
  { value: "America/Mexico_City", label: "America/Mexico_City (UTC-6)" },
  { value: "America/Bogota", label: "America/Bogota (UTC-5)" },
  { value: "America/Lima", label: "America/Lima (UTC-5)" },
  { value: "America/Santiago", label: "America/Santiago (UTC-4)" },
  { value: "Europe/London", label: "Europe/London (UTC+0)" },
  { value: "Europe/Paris", label: "Europe/Paris (UTC+1)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (UTC+1)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon (UTC+0)" },
  { value: "Africa/Lagos", label: "Africa/Lagos (UTC+1)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (UTC+8)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (UTC+5:30)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (UTC+10)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (UTC+12)" },
];

export default function BotSettingsPage() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { bot, loading, error, refresh } = useBotDetail(botId);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BotSettings>({});
  const [newAdminId, setNewAdminId] = useState("");

  useEffect(() => {
    if (bot?.settings) {
      setSettings(bot.settings);
    }
  }, [bot]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
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

  function update(fields: Partial<BotSettings>) {
    setSettings((prev: BotSettings) => ({ ...prev, ...fields }));
  }

  async function handleSave() {
    if (!botId) return;
    setSaving(true);
    try {
      const cleaned: BotSettings = {
        timezone: settings.timezone || undefined,
        language: settings.language || undefined,
        maxDailyPixGenerations: settings.maxDailyPixGenerations ?? undefined,
        resetPixAfterStart: settings.resetPixAfterStart ?? undefined,
        adminTelegramIds: settings.adminTelegramIds?.length ? settings.adminTelegramIds : undefined,
      };
      await api.updateBotSettings(botId, cleaned);
      setSettings(cleaned);
      refresh();
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function addAdminId() {
    const trimmed = newAdminId.trim();
    if (!trimmed || !/^\d+$/.test(trimmed)) return;
    const current = settings.adminTelegramIds ?? [];
    if (current.includes(trimmed)) return;
    update({ adminTelegramIds: [...current, trimmed] });
    setNewAdminId("");
  }

  function removeAdminId(id: string) {
    const current = settings.adminTelegramIds ?? [];
    update({ adminTelegramIds: current.filter((x) => x !== id) });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/manager/${botId}/dashboard`)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="size-5 text-muted-foreground" />
            Bot Settings
          </h1>
          <p className="text-sm text-muted-foreground">{bot.name}</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <p className="text-[11px] text-muted-foreground">
              Bot-level default timezone. Used for daily audio scheduling, time compliments, and other time-sensitive features.
            </p>
            <Select
              value={settings.timezone ?? ""}
              onValueChange={(v) => update({ timezone: v || undefined })}
            >
              <SelectTrigger className="h-9 text-sm max-w-sm">
                <SelectValue placeholder="None (server default)" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value || "_none"} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <p className="text-[11px] text-muted-foreground">
              Fallback language for bot-generated system messages.
            </p>
            <Select
              value={settings.language ?? ""}
              onValueChange={(v) => update({ language: v || undefined })}
            >
              <SelectTrigger className="h-9 text-sm max-w-sm">
                <SelectValue placeholder="None (default)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (default)</SelectItem>
                <SelectItem value="pt">Portuguese (pt)</SelectItem>
                <SelectItem value="en">English (en)</SelectItem>
                <SelectItem value="es">Spanish (es)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-medium mb-4">PIX Settings</h3>

            <div className="space-y-2">
              <Label htmlFor="maxDailyPix">Max daily PIX generations</Label>
              <p className="text-[11px] text-muted-foreground">
                Per-user limit on raw PIX code fetches. Uses global default ({bot.settings?.maxDailyPixGenerations ? "overridden" : "from env"}) if left empty.
              </p>
              <Input
                id="maxDailyPix"
                type="number"
                min={0}
                placeholder="Uses global default"
                value={settings.maxDailyPixGenerations ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  update({ maxDailyPixGenerations: v && v > 0 ? v : undefined });
                }}
                className="h-9 text-sm max-w-[200px]"
              />
            </div>

              <div className="flex items-center gap-3 pt-4">
                <Switch
                  size="sm"
                  checked={settings.resetPixAfterStart !== false}
                  onCheckedChange={(v) => update({ resetPixAfterStart: v })}
                />
                <div>
                  <Label className="text-sm">Reset PIX counter on /start</Label>
                  <p className="text-[11px] text-muted-foreground">
                    When enabled, the /start command resets the user&apos;s PIX generation counter to zero.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-medium mb-4">Admin Users</h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                Telegram user IDs that appear as quick-select options in the Utils &rarr; Get File ID tool.
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {(settings.adminTelegramIds ?? []).map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium"
                  >
                    {id}
                    <button
                      type="button"
                      onClick={() => removeAdminId(id)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {(settings.adminTelegramIds ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">No admin users configured</span>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Telegram ID (ex: 57837291)"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addAdminId(); }}
                  className="h-9 text-sm max-w-[250px]"
                />
                <Button variant="outline" size="sm" onClick={addAdminId} disabled={!newAdminId.trim()}>
                  Add
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 size-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
