import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Info, Send, Trash2, Activity } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  {
    step: 1,
    title: "Create a Pixel in Events Manager",
    description:
      'Go to Facebook Events Manager \u2192 Connect Data Sources \u2192 Web \u2192 Conversions API. Give it a name and copy the Pixel ID.',
  },
  {
    step: 2,
    title: "Generate an Access Token",
    description:
      "In Events Manager, open your Pixel \u2192 Settings \u2192 Conversions API. Click \"Generate Access Token\" and copy it.",
  },
  {
    step: 3,
    title: "Paste credentials below",
    description:
      "Fill in the Pixel ID and Access Token fields on this page, toggle Enabled, and click Save.",
  },
  {
    step: 4,
    title: "Test the connection",
    description:
      "Click \"Send Test Event\" to verify that events reach Facebook. A successful test sends a PageView event via CAPI.",
  },
];

const TRACKED_EVENTS = [
  "ViewContent \u2014 when a message step with a title is shown",
  "AddPaymentInfo \u2014 when a PIX code is generated",
  "CompleteRegistration / StartTrial \u2014 on /start (new vs. returning users)",
  "Lead \u2014 on every incoming text message",
  "Purchase \u2014 when a payment is confirmed",
  "InitiateCheckout \u2014 when a user clicks a payment button",
];

export default function BotPixelConfigPage() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState("");

  useEffect(() => {
    void loadConfig();
  }, [botId]);

  async function loadConfig() {
    if (!botId) return;
    setLoading(true);
    try {
      const data = await api.getPixelConfig(botId);
      setPixelId(data.pixelId ?? "");
      setEnabled(data.enabled);
      setHasToken(data.hasToken);
      setAccessToken("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pixel config");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!botId) return;
    if (!pixelId.trim() || !accessToken.trim()) {
      toast.error("Pixel ID and Access Token are required");
      return;
    }
    setSaving(true);
    try {
      const result = await api.updatePixelConfig(botId, {
        pixelId: pixelId.trim(),
        accessToken: accessToken.trim(),
        enabled,
      });
      setPixelId(result.pixelId);
      setEnabled(result.enabled);
      setHasToken(result.hasToken);
      setAccessToken("");
      toast.success("Pixel configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save pixel config");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!botId) return;
    setTesting(true);
    try {
      const result = await api.testPixelEvent(botId, testEventCode || undefined);
      if (result.sent) {
        toast.success(`Test event sent (ID: ${result.eventId})`);
      } else {
        toast.error(result.error ?? "Test event failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test event failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!botId) return;
    if (!window.confirm("Disconnect Facebook Pixel? This clears stored credentials and disables tracking for this bot.")) return;
    setDeleting(true);
    try {
      await api.deletePixelConfig(botId);
      setPixelId("");
      setAccessToken("");
      setEnabled(false);
      setHasToken(false);
      toast.success("Pixel configuration removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove pixel config");
    } finally {
      setDeleting(false);
    }
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
        <Button variant="outline" onClick={() => { void loadConfig(); }}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/manager/${botId}/dashboard`)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="size-5 text-muted-foreground" />
            Facebook Pixel (CAPI)
          </h1>
          <p className="text-sm text-muted-foreground">Server-side event tracking via Conversions API</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowInfo((v) => !v)}
          title="How to configure"
        >
          <Info className="size-5" />
        </Button>
      </div>

      {showInfo && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="space-y-6 p-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">What is the Conversions API (CAPI)?</h3>
              <p className="text-sm text-muted-foreground">
                Facebook's Conversions API sends events directly from your server to Facebook.
                Unlike the browser Pixel, CAPI is not blocked by ad blockers and provides more
                reliable tracking data for your ad campaigns, retargeting, and conversion optimization.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Setup steps</h3>
              <div className="space-y-3">
                {STEPS.map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <Badge variant="secondary" className="mt-0.5 h-5 w-5 shrink-0 rounded-full p-0 text-[10px] flex items-center justify-center">
                      {s.step}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold mb-2">Tracked events</h3>
              <p className="text-xs text-muted-foreground mb-2">
                The following Meta standard events are tracked automatically when the pixel is enabled:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {TRACKED_EVENTS.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold mb-2">Privacy notice</h3>
              <p className="text-sm text-muted-foreground">
                User Telegram IDs are hashed with SHA-256 before being sent to Facebook, as required
                by Meta's CAPI specification. No raw identifiable user data is transmitted.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="pixelId">Pixel ID</Label>
            <p className="text-[11px] text-muted-foreground">
              Found in Events Manager under your Pixel's details.
            </p>
            <Input
              id="pixelId"
              type="text"
              placeholder="123456789012345"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              className="h-9 text-sm max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessToken">Access Token</Label>
            <p className="text-[11px] text-muted-foreground">
              Generated in Events Manager &rarr; Settings &rarr; Conversions API.
              {hasToken && " A token is currently stored."}
            </p>
            <Input
              id="accessToken"
              type="password"
              placeholder={hasToken ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "EAA..."}
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="h-9 text-sm max-w-sm"
            />
          </div>

          <div className="border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <Switch
                size="sm"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <div>
                <Label className="text-sm">Enable event tracking</Label>
                <p className="text-[11px] text-muted-foreground">
                  Standard events will be sent to Facebook via CAPI for every user interaction.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="destructive"
          onClick={() => void handleDelete()}
          disabled={deleting || !hasToken}
          size="sm"
        >
          <Trash2 className="mr-2 size-4" />
          {deleting ? "Removing..." : "Disconnect"}
        </Button>

        <div className="flex gap-2">
          {hasToken && (
            <>
              <Input
                type="text"
                placeholder="TEST40087"
                value={testEventCode}
                onChange={(e) => setTestEventCode(e.target.value)}
                className="h-9 w-36 text-sm"
              />
              <Button
                variant="outline"
                onClick={() => void handleTest()}
                disabled={testing || !enabled}
              >
                <Send className="mr-2 size-4" />
                {testing ? "Sending..." : "Send Test Event"}
              </Button>
            </>
          )}
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
