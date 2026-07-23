import { logger } from "../utils/logger.js";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

const CAPI_VERSION = "v22.0";
const CAPI_URL_BASE = `https://graph.facebook.com/${CAPI_VERSION}`;

type PixelEventData = {
  eventName: string;
  eventTime: number;
  userData: { externalId: string };
  customData?: Record<string, unknown>;
  eventSourceUrl: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function logPixelEvent(
  botId: string,
  userId: string | undefined,
  eventName: string,
  eventId: string,
  customData: Record<string, unknown> | undefined,
  success: boolean,
  statusCode?: number,
  error?: string
): Promise<void> {
  void prisma.pixelEvent.create({
    data: {
      botId,
      userId: userId ?? undefined,
      eventName,
      eventId,
      customData: customData as Prisma.InputJsonValue | undefined,
      success,
      statusCode: statusCode ?? undefined,
      error
    }
  }).catch((err: Error) => {
    logger.error(`[facebook-pixel] Failed to write pixel event log: ${err.message}`);
  });
}

function postToCapi(
  botId: string,
  userId: string | undefined,
  pixelId: string,
  accessToken: string,
  eventName: string,
  eventId: string,
  customData: Record<string, unknown> | undefined,
  payload: Record<string, unknown>
): void {
  const url = `${CAPI_URL_BASE}/${pixelId}/events?access_token=${accessToken}`;

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  }).then(async (response) => {
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      logger.error(`[facebook-pixel] CAPI responded ${response.status}: ${body}`);
      await logPixelEvent(botId, userId, eventName, eventId, customData, false, response.status, body.slice(0, 1000));
    } else {
      await logPixelEvent(botId, userId, eventName, eventId, customData, true, response.status);
    }
  }).catch(async (err: Error) => {
    logger.error(`[facebook-pixel] CAPI request failed: ${err.message}`);
    await logPixelEvent(botId, userId, eventName, eventId, customData, false, undefined, err.message);
  });
}

export function sendPixelEvent(
  botId: string,
  userId: string | undefined,
  telegramId: bigint | undefined,
  botUsername: string | undefined,
  botPixelId: string | undefined | null,
  botAccessToken: string | undefined | null,
  botEnabled: boolean | undefined | null,
  data: PixelEventData
): void {
  const pixelId = botPixelId?.trim();
  const accessToken = botAccessToken?.trim();
  if (!pixelId || !accessToken) return;
  if (!botEnabled) return;

  const eventId = randomUUID();

  const payload = {
    data: [{
      event_name: data.eventName,
      event_time: data.eventTime,
      action_source: "system_generated",
      event_source_url: botUsername ? `https://t.me/${botUsername}` : `https://t.me/bot`,
      event_id: eventId,
      user_data: {
        external_id: telegramId != null ? sha256(telegramId.toString()) : sha256("anonymous")
      },
      custom_data: data.customData ?? {}
    }]
  };

  postToCapi(botId, userId, pixelId, accessToken, data.eventName, eventId, data.customData, payload);
}

export async function testPixelEvent(
  botId: string,
  botPixelId: string | undefined | null,
  botAccessToken: string | undefined | null,
  botEnabled: boolean | undefined | null,
  botUsername: string | undefined
): Promise<{ sent: boolean; eventId: string; error?: string }> {
  const pixelId = botPixelId?.trim();
  const accessToken = botAccessToken?.trim();
  if (!pixelId || !accessToken) return { sent: false, eventId: "", error: "Pixel ID and access token not configured" };
  if (!botEnabled) return { sent: false, eventId: "", error: "Pixel events are disabled for this bot" };

  const eventId = randomUUID();

  const payload = {
    data: [{
      event_name: "PageView",
      event_time: Math.floor(Date.now() / 1000),
      action_source: "system_generated",
      event_source_url: botUsername ? `https://t.me/${botUsername}` : "",
      event_id: eventId,
      user_data: {
        external_id: sha256("test_user")
      }
    }]
  };

  const url = `${CAPI_URL_BASE}/${pixelId}/events?access_token=${accessToken}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      return { sent: false, eventId, error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true, eventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, eventId, error: message };
  }
}

export type { PixelEventData };
