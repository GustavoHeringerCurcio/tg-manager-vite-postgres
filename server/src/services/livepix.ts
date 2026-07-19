import QRCode from "qrcode";
import type { Telegram } from "telegraf";
import { delay } from "../utils/async.js";

const OAUTH_URL = "https://oauth.livepix.gg/oauth2/token";
const API_URL = "https://api.livepix.gg/v2";
const WEBSERVICE_URL = "https://webservice.livepix.gg";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Content-Type": "application/json",
  Origin: "https://checkout.livepix.gg",
  Referer: "https://checkout.livepix.gg/"
};

type TokenResponse = { access_token: string; expires_in: number };
type PaymentResponse = { reference?: string; id?: string; redirectUrl?: string; checkoutUrl?: string };
type PixResponse = { code?: string; pixCode?: string };

export type LivePixPayment = {
  reference: string;
  checkoutUrl: string;
};

export class LivePixService {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private pendingPayments = new Map<string, { chatId: number | undefined; amount: number; confirmed: boolean }>();
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly clientId: string, private readonly clientSecret: string) {}

  private async requestToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "payments:write"
    });
    const response = await fetch(OAUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`LivePix authentication failed with status ${response.status}`);
    const data = (await response.json()) as TokenResponse;
    if (!data.access_token) throw new Error("LivePix authentication response missing access token");
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + Math.max(data.expires_in - 60, 60) * 1000;
    return this.accessToken;
  }

  async createPayment(amountBrl: number): Promise<LivePixPayment> {
    const token = await this.requestToken();
    const response = await fetch(`${API_URL}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.round(amountBrl * 100), currency: "BRL" }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`LivePix payment creation failed with status ${response.status}`);
    const data = (await response.json()) as PaymentResponse;
    const checkoutUrl = data.redirectUrl ?? data.checkoutUrl;
    const reference = data.reference ?? data.id;
    if (!checkoutUrl || !reference) throw new Error("LivePix payment response missing checkout URL or reference");
    return { reference, checkoutUrl };
  }

  async extractPixCode(checkoutUrl: string): Promise<string | undefined> {
    const checkoutId = extractCheckoutId(checkoutUrl);
    if (!checkoutId) return undefined;
    await delay(1500);
    return fetchPixCodeViaWebservice(checkoutId);
  }

  async checkPayment(reference: string): Promise<{ status: string; amount: number } | null> {
    const token = await this.requestToken();
    const response = await fetch(`${API_URL}/payments?reference=${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: Array<{ status?: string; amount?: number }> };
    if (!data.data || data.data.length === 0) return null;
    const payment = data.data[0];
    return { status: payment.status ?? "UNKNOWN", amount: payment.amount ?? 0 };
  }

  async generateQrCode(pixCode: string): Promise<Buffer> {
    const qrBuffer = await QRCode.toBuffer(pixCode, {
      type: "png",
      width: 512,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" }
    });
    return qrBuffer;
  }

  registerPendingPayment(reference: string, chatId: number | undefined, amount: number): void {
    this.pendingPayments.set(reference, { chatId, amount, confirmed: false });
  }

  startPaymentPolling(telegram: Telegram): void {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(() => {
      void this.processPendingPayments(telegram);
    }, 30_000);
  }

  stopPaymentPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async processPendingPayments(telegram: Telegram): Promise<void> {
    for (const [ref, entry] of this.pendingPayments.entries()) {
      if (entry.confirmed) continue;
      try {
        const payment = await this.checkPayment(ref);
        if (payment && payment.amount > 0) {
          entry.confirmed = true;
          if (entry.chatId) {
            try {
              await telegram.sendMessage(
                entry.chatId,
                `Pagamento confirmado!\n\nValor: R$ ${(payment.amount / 100).toFixed(2)}\n\nObrigado pela sua compra!`
              );
            } catch (err) {
              console.error(`Failed to notify chat ${entry.chatId}:`, err instanceof Error ? err.message : err);
            }
          }
          this.pendingPayments.delete(ref);
        }
      } catch (err) {
        console.error(`Polling error for payment ${ref}:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

export function extractCheckoutId(checkoutUrl: string): string | undefined {
  try {
    const parsed = new URL(checkoutUrl);
    const id = parsed.pathname.split("/").filter(Boolean).pop();
    return id && id.length > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

function jitter(delayMs: number): number {
  return Math.round(delayMs * (0.5 + Math.random()));
}

function shouldRetry(status: number, contentType: string): boolean {
  if (status === 429 || status >= 500) return true;
  if (status === 403 && !contentType.includes("application/json")) return true;
  return false;
}

export async function fetchPixCodeViaWebservice(checkoutId: string): Promise<string | undefined> {
  const delays = [0, 800, 1200, 1800, 2700, 4050];
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await delay(jitter(delays[attempt]));
    try {
      const response = await fetch(`${WEBSERVICE_URL}/checkout/payment/${checkoutId}`, {
        method: "POST",
        headers: BROWSER_HEADERS,
        body: JSON.stringify({ method: "pix" }),
        signal: AbortSignal.timeout(10000)
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok) {
        if (shouldRetry(response.status, contentType) && attempt < delays.length - 1) continue;
        return undefined;
      }
      if (!contentType.includes("application/json")) {
        if (attempt < delays.length - 1) continue;
        return undefined;
      }
      const data = (await response.json()) as PixResponse;
      return data.code ?? data.pixCode;
    } catch {
      if (attempt === delays.length - 1) return undefined;
    }
  }
  return undefined;
}
