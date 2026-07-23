import { randomBytes } from "node:crypto";
import type { Bot } from "@prisma/client";
import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { registerHandlers } from "./handlers.js";
import type { AppEnv } from "../utils/env.js";
import { LivePixService } from "../services/livepix.js";
import { applyRateLimit } from "../utils/rateLimiter.js";

export class BotManager {
  readonly botId: string;
  readonly path: string;
  private readonly secretToken: string;
  private readonly telegraf: Telegraf<Context>;
  private readonly livePix: LivePixService;
  private readonly webhookHandler: (req: any, res: any, next: any) => void;

  constructor(config: Bot, token: string, env: AppEnv) {
    this.botId = config.id;
    this.path = `/webhook/${config.id}`;
    this.secretToken = randomBytes(32).toString("hex");
    this.telegraf = new Telegraf(token, { telegram: { webhookReply: false } });
    applyRateLimit(
      this.telegraf.telegram,
      Number(process.env.TELEGRAM_RATE_LIMIT ?? "25"),
      Number(process.env.TELEGRAM_RATE_BURST ?? "30")
    );
    this.livePix = new LivePixService(env.livepixClientId, env.livepixClientSecret, env.livepixRedirectUrl);
    this.webhookHandler = this.telegraf.webhookCallback(this.path, { secretToken: this.secretToken });
    registerHandlers(this.telegraf, config, { env, livePix: this.livePix });
    this.telegraf.catch((error) => {
      const message = error instanceof Error ? error.message : "bot handler failed";
      console.error(`[bot:${config.id}] ${message}`);
    });
  }

  async validateToken(): Promise<void> {
    try {
      await Promise.race([
        this.telegraf.telegram.getMe(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("telegram getMe timed out")), 10000))
      ]);
    } catch (error) {
      throw (error instanceof Error) ? error : new Error(String(error));
    }
  }

  async start(domain: string): Promise<void> {
    try {
      await Promise.race([
        this.telegraf.telegram.setWebhook(`https://${domain}${this.path}`, {
          secret_token: this.secretToken,
          drop_pending_updates: true,
          allowed_updates: ["message", "callback_query"]
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("telegram setWebhook timed out")), 10000))
      ]);
    } catch (error) {
      throw (error instanceof Error) ? error : new Error(String(error));
    }
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

  get livepix() {
    return this.livePix;
  }

  webhookMiddleware() {
    return this.webhookHandler;
  }
}
