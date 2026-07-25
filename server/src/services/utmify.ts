import { logger } from "../utils/logger.js";

const UTMIFY_URL = "https://api.utmify.com.br/api-credentials/orders";

export interface UtmifyOrderParams {
  botId: string;
  orderId: string;
  status: "paid";
  customerName: string;
  customerEmail: string;
  productName: string;
  priceInCents: number;
  utmParams: Record<string, string> | null;
  totalPaidCents: number;
  createdAt: Date;
  apiToken: string;
  enabled: boolean;
}

export function sendUtmifyOrder(params: UtmifyOrderParams): void {
  if (!params.enabled) return;
  if (!params.apiToken?.trim()) return;

  const approvedDate = new Date();
  const createdUtc = new Date(params.createdAt.getTime() - params.createdAt.getTimezoneOffset() * 60000)
    .toISOString().replace("T", " ").slice(0, 19);
  const approvedUtc = new Date(approvedDate.getTime() - approvedDate.getTimezoneOffset() * 60000)
    .toISOString().replace("T", " ").slice(0, 19);

  const payload = {
    orderId: params.orderId,
    platform: "Botflix",
    paymentMethod: "pix",
    status: params.status,
    createdAt: createdUtc,
    approvedDate: approvedUtc,
    refundedAt: null,
    customer: {
      name: params.customerName,
      email: params.customerEmail
    },
    products: [{
      id: params.orderId,
      name: params.productName,
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: params.priceInCents
    }],
    trackingParameters: {
      src: null,
      sck: null,
      utm_source: params.utmParams?.utm_source ?? null,
      utm_campaign: params.utmParams?.utm_campaign ?? null,
      utm_medium: params.utmParams?.utm_medium ?? null,
      utm_content: params.utmParams?.utm_content ?? null,
      utm_term: params.utmParams?.utm_term ?? null
    },
    commission: {
      totalPriceInCents: params.totalPaidCents,
      gatewayFeeInCents: 0,
      userCommissionInCents: params.totalPaidCents
    }
  };

  void fetch(UTMIFY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-token": params.apiToken.trim()
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  }).then(async (response) => {
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      logger.error(`[utmify] Order ${params.orderId} failed: HTTP ${response.status} - ${body.slice(0, 500)}`);
    } else {
      logger.info(`[utmify] Order ${params.orderId} sent (status: ${params.status})`);
    }
  }).catch((err: Error) => {
    logger.error(`[utmify] Order ${params.orderId} request failed: ${err.message}`);
  });
}
