import { BotStatus, type Bot } from "@prisma/client";
import type { AppEnv } from "../utils/env.js";
import { prisma } from "./prisma.js";
import { BotManager } from "../bot/manager.js";
import { getBotManager, listBotManagers, registerBotManager, removeBotManager } from "./botRegistry.js";

export async function startBot(bot: Bot, env: AppEnv, skipWebhook = false): Promise<void> {
  const existing = getBotManager(bot.id);
  if (existing) return;
  const manager = new BotManager(bot, bot.token, env);
  await manager.validateToken();
  if (!skipWebhook) await manager.start(env.domain);
  await registerBotManager(bot.id, manager);
}

export async function stopBot(botId: string): Promise<void> {
  const manager = getBotManager(botId);
  if (!manager) return;
  await manager.stop();
  removeBotManager(botId);
}

export async function loadActiveBots(env: AppEnv, skipWebhook = false): Promise<void> {
  const bots = await prisma.bot.findMany({ where: { status: BotStatus.ACTIVE } });
  const results = await Promise.allSettled(
    bots.map((bot) => startBot(bot, env, skipWebhook))
  );
  let started = 0;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      started += 1;
    } else {
      const message = result.reason instanceof Error ? result.reason.message : "bot startup failed";
      console.error(`[bot:${bots[i].id}] ${message}`);
    }
  }
  console.log(`[bots] Started ${started}/${bots.length} active bots`);
}

export async function shutdownAllBots(): Promise<void> {
  const managers = listBotManagers();
  for (const [botId, manager] of managers) {
    await manager.stop();
    removeBotManager(botId);
  }
}
