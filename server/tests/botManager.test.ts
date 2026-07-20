import { BotStatus, type Bot } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../src/utils/env.js";

const telegrafMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    telegram: { deleteWebhook: ReturnType<typeof vi.fn> };
    stop: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock("telegraf", () => {
  class MockTelegraf {
    telegram = {
      getMe: vi.fn().mockResolvedValue({ id: 1, is_bot: true, username: "bot" }),
      setWebhook: vi.fn().mockResolvedValue(true),
      deleteWebhook: vi.fn().mockResolvedValue(true)
    };
    use = vi.fn();
    start = vi.fn();
    on = vi.fn();
    catch = vi.fn();
    stop = vi.fn(() => {
      throw new Error("Bot is not running!");
    });
    webhookCallback = vi.fn();

    constructor() {
      telegrafMocks.instances.push(this);
    }
  }

  return {
    Composer: { fork: vi.fn((handler: unknown) => handler) },
    Telegraf: MockTelegraf
  };
});

const { BotManager } = await import("../src/bot/manager.js");

describe("BotManager", () => {
  it("stops webhook-managed bots without calling Telegraf.stop", async () => {
    const bot: Bot = {
      id: "bot_1",
      name: "Test Bot",
      token: "encrypted-token",
      messageFlow: [{ id: "welcome", title: "Welcome", type: "TEXT", text: "Welcome", delayMs: 0, buttons: [] }],
      remarketing: {},
      paymentFlow: { steps: [], verifyLabel: "Verificar pagamento", pixCopyLabel: "Copiar PIX" },
      status: BotStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const env: AppEnv = {
      nodeEnv: "test",
      appPort: 3000,
      domain: "example.com",
      adminPassword: "secret",
      encryptionKey: "test-key",
      livepixClientId: "client-id",
      livepixClientSecret: "client-secret",
      maxPixGenerations: 5,
      interactionRetentionDays: 90,
      logPayloads: false
    };

    const manager = new BotManager(bot, "telegram-token", env);

    await expect(manager.stop()).resolves.toBeUndefined();
    expect(telegrafMocks.instances[0].telegram.deleteWebhook).toHaveBeenCalledOnce();
    expect(telegrafMocks.instances[0].stop).not.toHaveBeenCalled();
  });
});
