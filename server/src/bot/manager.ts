import { randomBytes } from "node:crypto";
import type { Bot } from "@prisma/client";
import { Composer, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import { registerHandlers } from "./handlers.js";
import type { AppEnv } from "../utils/env.js";
import { LivePixService } from "../services/livepix.js";
import { normalizePaymentFlow, type PaymentFlow } from "./paymentFlow.js";

export class BotManager {
  readonly botId: string;
  readonly path: string;
  private readonly secretToken: string;
  private readonly telegraf: Telegraf<Context>;
  private readonly livePix: LivePixService;
  private readonly paymentFlow: PaymentFlow;
  private readonly webhookHandler: (req: any, res: any, next: any) => void;

  constructor(config: Bot, token: string, env: AppEnv) {
    this.botId = config.id;
    this.path = `/webhook/${config.id}`;
    this.secretToken = randomBytes(32).toString("hex");
    this.telegraf = new Telegraf(token);
    this.livePix = new LivePixService(env.livepixClientId, env.livepixClientSecret, env.livepixRedirectUrl);
    this.paymentFlow = normalizePaymentFlow(config.paymentFlow);
    this.webhookHandler = this.telegraf.webhookCallback(this.path, { secretToken: this.secretToken });
    this.telegraf.use(Composer.fork(async (ctx) => {
      ctx.telegram.webhookReply = false;
      return Promise.resolve();
    }));
    // LivePix verify payment callback handler
    this.telegraf.on("callback_query", async (ctx, next) => {
      try {
        const data = "data" in ctx.callbackQuery ? (ctx.callbackQuery as any).data as string : undefined;
        if (!data || !data.startsWith("livepix_payment:verify")) {
          return next();
        }

        // Always answer callback immediately to stop the loading spinner
        try {
          await ctx.answerCbQuery();
        } catch {
          // ignore
        }

        // Attempt to extract the LivePix reference from the callback data, if present.
        let reference: string | undefined;
        try {
          const parts = data.split(":");
          reference = parts.length >= 3 ? parts.slice(2).join(":") : undefined;
        } catch {
          reference = undefined;
        }

        let paid = false;
        if (reference) {
          try {
            const result = await this.livePix.checkPayment(reference);
            if (result && typeof result.status === "string") {
              const status = result.status.toUpperCase();
              paid = status === "PAID" || status === "APPROVED" || status === "CONFIRMED";
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[bot:${this.botId}] livepix verify failed: ${message}`);
          }
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;

        if (paid) {
          try {
            await ctx.telegram.sendMessage(chatId, "OK");
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[bot:${this.botId}] sendMessage failed: ${message}`);
          }
          return;
        }

        const list = this.paymentFlow.unpaidAudioFileIds ?? [];
        if (list.length === 0) {
          return;
        }

        const index = Math.floor(Math.random() * list.length);
        const fileId = list[index];
        if (!fileId) return;

        try {
          await ctx.telegram.sendVoice(chatId, fileId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[bot:${this.botId}] sendVoice failed: ${message}`);
        }
      } catch {
        // noop
      }
    });
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
