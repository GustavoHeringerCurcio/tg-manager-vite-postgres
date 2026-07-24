import { logger } from "../utils/logger.js";
import { prisma } from "./prisma.js";
import { normalizeBotSettings } from "../bot/botSettings.js";
import { getGlobalConfig } from "../bot/globalConfig.js";

interface BarkPayload {
  title: string;
  body: string;
  sound: string;
  deviceKey: string;
  serverUrl: string;
}

async function sendBark(payload: BarkPayload): Promise<void> {
  const { serverUrl, deviceKey, title, body, sound } = payload;
  const base = serverUrl.replace(/\/+$/, "");
  const url = `${base}/${encodeURIComponent(deviceKey)}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?sound=${encodeURIComponent(sound)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal
    });

    const data = await response.json().catch(() => null) as Record<string, unknown> | null;

    if (!response.ok || data?.code !== 200) {
      logger.error(`[bark] notification failed: HTTP ${response.status}, body: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`[bark] notification error: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyPurchaseConfirmed(
  botId: string,
  amount: number,
  userName?: string
): Promise<void> {
  try {
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { name: true, settings: true }
    });

    if (!bot) return;

    const settings = normalizeBotSettings(bot.settings);

    if (!settings.barkEnabled || !settings.barkDeviceKey) return;

    const deviceKey = settings.barkDeviceKey;
    const sound = settings.barkSound || "cashregister";
    const serverUrl = settings.barkServerUrl || "https://api.day.app";

    const displayName = userName || "someone";
    const amountStr = amount.toFixed(2);

    await sendBark({
      title: `💰 Sale! R$ ${amountStr}`,
      body: `${displayName} just purchased on ${bot.name}`,
      sound,
      deviceKey,
      serverUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`[bark] notifyPurchaseConfirmed failed: ${message}`);
  }
}

export async function sendSystemAlert(title: string, body: string): Promise<void> {
  try {
    const config = getGlobalConfig();

    if (!config.barkAlertEnabled || !config.barkAlertDeviceKey) return;

    await sendBark({
      title,
      body: body.slice(0, 500),
      sound: "alarm",
      deviceKey: config.barkAlertDeviceKey,
      serverUrl: "https://api.day.app"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`[bark] sendSystemAlert failed: ${message}`);
  }
}
