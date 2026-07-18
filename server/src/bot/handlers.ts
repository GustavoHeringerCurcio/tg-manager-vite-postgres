import type { Bot, User } from "@prisma/client";
import { PaymentMethod } from "@prisma/client";
import type { Context, Telegraf } from "telegraf";
import type { InlineKeyboardMarkup, InputMediaVideo, Message } from "telegraf/types";
import { delay } from "../utils/async.js";
import { prisma } from "../services/prisma.js";
import { logInteraction } from "../services/logger.js";
import type { AppEnv } from "../utils/env.js";
import { LivePixService } from "../services/livepix.js";
import { normalizeMessageFlow } from "./messageFlow.js";
import type { MessageButton, MessageStep } from "./messageFlow.js";

const LIVEPIX_CALLBACK_PREFIX = "livepix_payment:";

type HandlerServices = {
  env: AppEnv;
  livePix: LivePixService;
};

function textFromMessage(message: Message): string {
  return "text" in message ? message.text : "[non-text message]";
}

async function upsertTelegramUser(botId: string, ctx: Context): Promise<User | null> {
  if (!ctx.from) return null;
  return prisma.user.upsert({
    where: { botId_telegramId: { botId, telegramId: BigInt(ctx.from.id) } },
    create: {
      botId,
      telegramId: BigInt(ctx.from.id),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      lastInteraction: new Date()
    },
    update: {
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      lastInteraction: new Date()
    }
  });
}

type KeyboardButton = { text: string; callback_data?: string; url?: string };
type Keyboard = { inline_keyboard: KeyboardButton[][] };

function jsonPayload(value: object): object {
  return JSON.parse(JSON.stringify(value)) as object;
}

function keyboard(step: MessageStep): Keyboard | undefined {
  if (step.buttons.length === 0) return undefined;
  return {
    inline_keyboard: step.buttons.map((button) => [{
      text: button.label,
      ...(button.action === "OPEN_URL" ? { url: button.url } : { callback_data: `${LIVEPIX_CALLBACK_PREFIX}${button.id}` })
    }])
  };
}

function findPaymentButton(steps: MessageStep[], id: string): MessageButton | undefined {
  for (const step of steps) {
    const button = step.buttons.find((item) => item.id === id && item.action === "LIVEPIX_PAYMENT");
    if (button) return button;
  }
  return undefined;
}

async function sendStep(ctx: Context, botConfig: Bot, user: User | null, step: MessageStep, env: AppEnv): Promise<void> {
  const replyMarkup = keyboard(step);
  const options = replyMarkup ? { reply_markup: replyMarkup as InlineKeyboardMarkup } : undefined;
  if (step.type === "VIDEO" && step.mediaUrls.length > 0) {
    if (step.mediaUrls.length === 1) {
      await ctx.replyWithVideo(step.mediaUrls[0], { caption: step.text, ...(options ?? {}) });
    } else {
      const mediaGroup: InputMediaVideo[] = step.mediaUrls.map((url, i) => ({
        type: "video",
        media: url,
        ...(i === 0 && step.text ? { caption: step.text } : {})
      }));
      await ctx.replyWithMediaGroup(mediaGroup);
    }
    logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "outgoing", content: `video:${step.title}`, logPayloads: env.logPayloads });
    return;
  }
  if (step.type === "AUDIO" && step.mediaUrls.length > 0) {
    await ctx.replyWithAudio(step.mediaUrls[0], { caption: step.text, ...(options ?? {}) });
    logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "outgoing", content: `audio:${step.title}`, logPayloads: env.logPayloads });
    return;
  }
  await ctx.reply(step.text ?? " ", options);
  logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "outgoing", content: step.text ?? step.title, logPayloads: env.logPayloads });
}

async function sendLivePixPayment(ctx: Context, botConfig: Bot, user: User, services: HandlerServices): Promise<void> {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { pixGenerations: { increment: 1 }, lastInteraction: new Date() }
    });
    const payment = await services.livePix.createPayment(botConfig.checkoutAmount);
    const pixAllowed = updatedUser.pixGenerations <= services.env.maxPixGenerations;
    const pixCode = pixAllowed ? await services.livePix.extractPixCode(payment.checkoutUrl) : undefined;
    await prisma.transaction.create({
      data: {
        botId: botConfig.id,
        userId: user.id,
        amount: botConfig.checkoutAmount,
        paymentMethod: PaymentMethod.PIX,
        status: "PENDING",
        pixCode,
        checkoutUrl: payment.checkoutUrl,
        livepixReference: payment.reference
      }
    });
    if (pixCode) {
      const text = `Pagamento PIX\n\nValor: R$ ${botConfig.checkoutAmount.toFixed(2)}\n\nCódigo PIX copia e cola:\n${pixCode}`;
      await ctx.reply(text);
      logInteraction({ botId: botConfig.id, userId: user.id, type: "message", direction: "outgoing", content: "PIX code sent", logPayloads: services.env.logPayloads });
      return;
    }
    const paymentReplyMarkup: Keyboard = { inline_keyboard: [[{ text: "Pagar via LivePix", url: payment.checkoutUrl }]] };
    await ctx.reply(`Pagamento PIX\n\nValor: R$ ${botConfig.checkoutAmount.toFixed(2)}\n\nClique no botão abaixo para pagar.`, { reply_markup: paymentReplyMarkup as InlineKeyboardMarkup });
    logInteraction({ botId: botConfig.id, userId: user.id, type: "message", direction: "outgoing", content: "LivePix checkout URL sent", logPayloads: services.env.logPayloads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment flow failed";
    console.error(`[bot:${botConfig.id}] ${message}`);
    await ctx.reply("Não foi possível gerar o pagamento agora. Tente novamente em instantes.");
    logInteraction({ botId: botConfig.id, userId: user.id, type: "message", direction: "outgoing", content: "payment error shown", logPayloads: services.env.logPayloads });
  }
}

export function registerHandlers(telegraf: Telegraf<Context>, botConfig: Bot, services: HandlerServices): void {
  const messageFlow = normalizeMessageFlow(botConfig.messageFlow);
  const activeStarts = new Set<number>();

  telegraf.start(async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || activeStarts.has(chatId)) return;
    activeStarts.add(chatId);
    try {
      const user = await upsertTelegramUser(botConfig.id, ctx);
      const message = ctx.message ? textFromMessage(ctx.message) : "/start";
      logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "incoming", content: message, payload: jsonPayload(ctx.update), logPayloads: services.env.logPayloads });
      if (messageFlow.length === 0) {
        await ctx.reply("Nenhuma mensagem configurada para este bot.");
        logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "outgoing", content: "empty message flow", logPayloads: services.env.logPayloads });
        return;
      }
      for (const [index, step] of messageFlow.entries()) {
        await sendStep(ctx, botConfig, user, step, services.env);
        if (step.delayMs > 0 && index < messageFlow.length - 1) await delay(step.delayMs);
      }
    } finally {
      activeStarts.delete(chatId);
    }
  });

  telegraf.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
    if (!data.startsWith(LIVEPIX_CALLBACK_PREFIX)) return;
    const buttonId = data.slice(LIVEPIX_CALLBACK_PREFIX.length);
    const button = findPaymentButton(messageFlow, buttonId);
    if (!button) {
      await ctx.answerCbQuery("Este botão não está mais disponível.");
      return;
    }
    await ctx.answerCbQuery("Gerando pagamento...");
    const user = await upsertTelegramUser(botConfig.id, ctx);
    if (!user) {
      await ctx.reply("Não foi possível identificar seu usuário. Tente novamente.");
      return;
    }
    logInteraction({ botId: botConfig.id, userId: user.id, type: "callback_query", direction: "incoming", content: data, payload: jsonPayload(ctx.update), logPayloads: services.env.logPayloads });
    await sendLivePixPayment(ctx, botConfig, user, services);
  });
}
