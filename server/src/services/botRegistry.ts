import type { BotManager } from "../bot/manager.js";

const botRegistry = new Map<string, BotManager>();

export function getBotManager(botId: string): BotManager | undefined {
  return botRegistry.get(botId);
}

export async function registerBotManager(botId: string, manager: BotManager): Promise<void> {
  const current = botRegistry.get(botId);
  if (current) await current.stop();
  botRegistry.set(botId, manager);
}

export function removeBotManager(botId: string): void {
  botRegistry.delete(botId);
}

export function hasBotManager(botId: string): boolean {
  return botRegistry.has(botId);
}

export function listBotManagers(): Array<[string, BotManager]> {
  return Array.from(botRegistry.entries());
}
