import { BotStatus, type Bot } from "@prisma/client";
import type { AppEnv } from "../utils/env.js";
import { decryptToken } from "./crypto.js";
import { prisma } from "./prisma.js";
import { BotManager } from "../bot/manager.js";
import { getBotManager, listBotManagers, registerBotManager, removeBotManager } from "./botRegistry.js";

export async function startBot(bot: Bot, env: AppEnv): Promise<void> {
  const existing = getBotManager(bot.id);
  if (existing) return;
  const token = decryptToken(bot.token, env.encryptionKey);
  const manager = new BotManager(bot, token, env);
  await manager.validateToken();
  await manager.start(env.domain);
  await registerBotManager(bot.id, manager);
}

export async function stopBot(botId: string): Promise<void> {
  const manager = getBotManager(botId);
  if (!manager) return;
  await manager.stop();
  removeBotManager(botId);
}

export async function loadActiveBots(env: AppEnv): Promise<void> {
  const bots = await prisma.bot.findMany({ where: { status: BotStatus.ACTIVE } });
  let started = 0;
  for (const bot of bots) {
    try {
      await startBot(bot, env);
      started += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "bot startup failed";
      console.error(`[bot:${bot.id}] ${message}`);
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
