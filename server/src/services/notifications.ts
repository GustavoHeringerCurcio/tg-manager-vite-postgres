import { logger } from "../utils/logger.js";
import { prisma } from "./prisma.js";
import { normalizeBotSettings } from "../bot/botSettings.js";
import { getGlobalConfig } from "../bot/globalConfig.js";
import { loadEnv } from "../utils/env.js";

interface BarkPayload {
  title: string;
  body: string;
  sound: string;
  deviceKey: string;
  serverUrl: string;
  icon?: string;
  group?: string;
  clickUrl?: string;
}

async function sendBark(payload: BarkPayload): Promise<void> {
  const { serverUrl, deviceKey, title, body, sound, icon, group, clickUrl } = payload;
  const base = serverUrl.replace(/\/+$/, "");

  const params = new URLSearchParams();
  params.set("sound", sound);
  if (icon) params.set("icon", icon);
  if (group) params.set("group", group);
  if (clickUrl) params.set("url", clickUrl);

  const url = `${base}/${encodeURIComponent(deviceKey)}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?${params.toString()}`;

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
    const sound = settings.barkSound || "kaching";
    const serverUrl = settings.barkServerUrl || "https://api.day.app";
    const icon = settings.barkIconUrl || undefined;

    const displayName = userName || "someone";
    const amountStr = amount.toFixed(2);

    let clickUrl: string | undefined;
    try {
      const env = loadEnv();
      clickUrl = `https://${env.domain}/manager/${botId}/dashboard`;
    } catch {
      // domain not available, skip click URL
    }

    await sendBark({
      title: `Sale Approved - R$ ${amountStr}`,
      body: `${displayName} just purchased on ${bot.name}`,
      sound,
      deviceKey,
      serverUrl,
      icon,
      group: "Sales",
      clickUrl
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
