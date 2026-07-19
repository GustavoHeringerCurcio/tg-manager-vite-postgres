import { randomBytes } from "node:crypto";
import type { Bot } from "@prisma/client";
import { Composer, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { registerHandlers } from "./handlers.js";
import type { AppEnv } from "../utils/env.js";
import { LivePixService } from "../services/livepix.js";

export class BotManager {
  readonly botId: string;
  readonly path: string;
  private readonly secretToken: string;
  private readonly telegraf: Telegraf<Context>;
  private readonly livePix: LivePixService;

  constructor(config: Bot, token: string, env: AppEnv) {
    this.botId = config.id;
    this.path = `/webhook/${config.id}`;
    this.secretToken = randomBytes(32).toString("hex");
    this.telegraf = new Telegraf(token);
    this.livePix = new LivePixService(env.livepixClientId, env.livepixClientSecret);
    this.telegraf.use(Composer.fork(async (ctx) => {
      ctx.telegram.webhookReply = false;
      return Promise.resolve();
    }));
    registerHandlers(this.telegraf, config, { env, livePix: this.livePix });
    this.telegraf.catch((error) => {
      const message = error instanceof Error ? error.message : "bot handler failed";
      console.error(`[bot:${config.id}] ${message}`);
    });
  }

  async validateToken(): Promise<void> {
    await this.telegraf.telegram.getMe();
  }

  async start(domain: string): Promise<void> {
    await this.telegraf.telegram.setWebhook(`https://${domain}${this.path}`, {
      secret_token: this.secretToken,
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"]
    });
  }

  async stop(): Promise<void> {
    try {
      await this.telegraf.telegram.deleteWebhook();
    } catch (error) {
      const message = error instanceof Error ? error.message : "delete webhook failed";
      console.error(`[bot:${this.botId}] ${message}`);
    }
  }

  get telegram() {
    return this.telegraf.telegram;
  }

  webhookMiddleware() {
    return this.telegraf.webhookCallback(this.path, { secretToken: this.secretToken });
  }
}
