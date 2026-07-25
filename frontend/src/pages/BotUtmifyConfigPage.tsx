import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Info, Send, Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  {
    step: 1,
    title: "Create an API credential in Utmify",
    description:
      "Go to your Utmify dashboard \u2192 Integrations \u2192 Webhooks \u2192 API Credentials \u2192 Add Credential. Copy the generated token.",
  },
  {
    step: 2,
    title: "Configure your landing page deep links",
    description:
      "Your landing page must encode UTM parameters into Telegram's start parameter (see below). The bot parses these on /start and stores them in the user session.",
  },
  {
    step: 3,
    title: "Paste the token below",
    description:
      "Enter the Utmify API token on this page, toggle Enabled, and click Save.",
  },
  {
    step: 4,
    title: "Test the connection",
    description:
      'Click "Send Test Order" to verify that orders reach Utmify. A successful test sends a test purchase to the Utmify API.',
  },
];

const PLACEMENTS = [
  { code: "1", name: "Instagram_Feed" },
  { code: "2", name: "Instagram_Reels" },
  { code: "3", name: "Instagram_Stories" },
  { code: "4", name: "Facebook_Feed" },
  { code: "5", name: "Facebook_Mobile_Feed" },
  { code: "6", name: "Facebook_Reels" },
  { code: "7", name: "Facebook_Marketplace" },
  { code: "8", name: "Audience_Network" },
  { code: "9", name: "Messenger" },
];

export default function BotUtmifyConfigPage() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [apiToken, setApiToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    void loadConfig();
  }, [botId]);

  async function loadConfig() {
    if (!botId) return;
    setLoading(true);
    try {
      const data = await api.getUtmifyConfig(botId);
      setEnabled(data.enabled);
      setHasToken(data.hasToken);
      setApiToken("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Utmify config");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!botId) return;
    if (!apiToken.trim()) {
      toast.error("API token is required");
      return;
    }
    setSaving(true);
    try {
      const result = await api.updateUtmifyConfig(botId, {
        apiToken: apiToken.trim(),
        enabled,
      });
      setEnabled(result.enabled);
      setHasToken(result.hasToken);
      setApiToken("");
      toast.success("Utmify configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save Utmify config");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!botId) return;
    setTesting(true);
    try {
      const result = await api.testUtmifyOrder(botId);
      if (result.sent) {
        toast.success(`Test order sent (ID: ${result.orderId})`);
      } else {
        toast.error(result.error ?? "Test order failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test order failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!botId) return;
    if (!window.confirm("Disconnect Utmify? This clears stored credentials and disables order tracking for this bot.")) return;
    setDeleting(true);
    try {
      await api.deleteUtmifyConfig(botId);
      setApiToken("");
      setEnabled(false);
      setHasToken(false);
      toast.success("Utmify configuration removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove Utmify config");
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
            <BarChart3 className="size-5 text-muted-foreground" />
            Utmify Tracking
          </h1>
          <p className="text-sm text-muted-foreground">Server-side purchase tracking via Utmify API</p>
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
              <h3 className="text-sm font-semibold mb-2">How Utmify purchase tracking works</h3>
              <p className="text-sm text-muted-foreground">
                Utmify tracks page views via a script on your landing page. Purchase events are sent
                server-side from this bot when a payment is confirmed (either manually via the Verify button
                or automatically by the payment poller).
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Landing page deep link format</h3>
              <p className="text-sm text-muted-foreground mb-2">
                To attribute purchases to campaigns, UTM parameters must be passed from the landing page
                to the bot via Telegram's <code className="text-xs bg-muted px-1 rounded">start</code> parameter:
              </p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                https://t.me/yourBot?start=FB~413591587909524~498046723566488~504346051220592~1
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Format: <code>utm_source~campaign_id~adset_id~ad_id~placement_code</code>
              </p>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold mb-2">Placement codes</h3>
              <div className="grid grid-cols-2 gap-1">
                {PLACEMENTS.map((p) => (
                  <div key={p.code} className="flex gap-2 text-sm">
                    <span className="font-mono text-xs bg-muted px-1 rounded">{p.code}</span>
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold mb-2">Server bridge (recommended)</h3>
              <p className="text-sm text-muted-foreground mb-2">
                For full UTM values (including campaign names), the landing page can POST UTM parameters to
                the bot server, which returns a short token for the deep link with no 64-char limit.
              </p>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
{`POST /api/entry
{ "utm": { "utm_source": "FB", "utm_campaign": "CAMPANHA_2|413591587909524", ... } }
→ { "token": "a1b2c3d4" }`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Deep link: <code>https://t.me/yourBot?start=a1b2c3d4</code>
              </p>
            </div>

            <div className="border-t border-border pt-4">
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="apiToken">API Token</Label>
            <p className="text-[11px] text-muted-foreground">
              Generated in Utmify dashboard &rarr; Integrations &rarr; Webhooks &rarr; API Credentials.
              {hasToken && " A token is currently stored."}
            </p>
            <Input
              id="apiToken"
              type="password"
              placeholder={hasToken ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "m0W6JF76..."}
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
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
                <Label className="text-sm">Enable purchase tracking</Label>
                <p className="text-[11px] text-muted-foreground">
                  Purchase events will be sent to Utmify when a payment is confirmed.
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
            <Button
              variant="outline"
              onClick={() => void handleTest()}
              disabled={testing || !enabled}
            >
              <Send className="mr-2 size-4" />
              {testing ? "Sending..." : "Send Test Order"}
            </Button>
          )}
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
