import type { Bot, User } from "@prisma/client";
import { PaymentMethod } from "@prisma/client";
import type { Context, Telegraf } from "telegraf";
import type { InlineKeyboardMarkup, Message } from "telegraf/types";
import { delay } from "../utils/async.js";
import { prisma } from "../services/prisma.js";
import { logInteraction } from "../services/logger.js";
import type { AppEnv } from "../utils/env.js";
import { LivePixService } from "../services/livepix.js";

const CHECKOUT_CALLBACK = "checkout";

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

type StyledKeyboardButton = { text: string; callback_data?: string; url?: string; style?: string };
type StyledKeyboard = { inline_keyboard: StyledKeyboardButton[][] };

function jsonPayload(value: object): object {
  return JSON.parse(JSON.stringify(value)) as object;
}

function keyboard(bot: Bot): StyledKeyboard {
  const buttons: StyledKeyboardButton[][] = [[{
    text: bot.checkoutButtonText,
    callback_data: CHECKOUT_CALLBACK,
    style: bot.checkoutButtonStyle
  }]];
  if (bot.supportUrl) {
    buttons.push([{ text: bot.supportButtonText, url: bot.supportUrl, style: bot.supportButtonStyle }]);
  }
  return { inline_keyboard: buttons };
}

export function registerHandlers(telegraf: Telegraf<Context>, botConfig: Bot, services: HandlerServices): void {
  telegraf.start(async (ctx) => {
    const user = await upsertTelegramUser(botConfig.id, ctx);
    const message = ctx.message ? textFromMessage(ctx.message) : "/start";
    logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "incoming", content: message, payload: jsonPayload(ctx.update), logPayloads: services.env.logPayloads });
    await ctx.reply("Olá! Bem-vindo.");
    logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "outgoing", content: "Olá! Bem-vindo.", logPayloads: services.env.logPayloads });
    await delay(1500);
    const replyMarkup = keyboard(botConfig);
    if (botConfig.welcomeVideoUrl) {
      await ctx.replyWithVideo(botConfig.welcomeVideoUrl, { caption: botConfig.welcomeText ?? undefined, reply_markup: replyMarkup as InlineKeyboardMarkup });
      logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "outgoing", content: "welcome video", logPayloads: services.env.logPayloads });
      return;
    }
    await ctx.reply(botConfig.welcomeText ?? "Escolha uma opção abaixo.", { reply_markup: replyMarkup as InlineKeyboardMarkup });
    logInteraction({ botId: botConfig.id, userId: user?.id, type: "message", direction: "outgoing", content: botConfig.welcomeText ?? "Escolha uma opção abaixo.", logPayloads: services.env.logPayloads });
  });

  telegraf.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
    if (data !== CHECKOUT_CALLBACK) return;
    await ctx.answerCbQuery("Gerando pagamento...");
    const user = await upsertTelegramUser(botConfig.id, ctx);
    if (!user) {
      await ctx.reply("Não foi possível identificar seu usuário. Tente novamente.");
      return;
    }
    logInteraction({ botId: botConfig.id, userId: user.id, type: "callback_query", direction: "incoming", content: data, payload: jsonPayload(ctx.update), logPayloads: services.env.logPayloads });
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
      const paymentReplyMarkup: StyledKeyboard = { inline_keyboard: [[{ text: "Pagar via LivePix", url: payment.checkoutUrl, style: "success" }]] };
      await ctx.reply(`Pagamento PIX\n\nValor: R$ ${botConfig.checkoutAmount.toFixed(2)}\n\nClique no botão abaixo para pagar.`, { reply_markup: paymentReplyMarkup as object as InlineKeyboardMarkup });
      logInteraction({ botId: botConfig.id, userId: user.id, type: "message", direction: "outgoing", content: "LivePix checkout URL sent", logPayloads: services.env.logPayloads });
    } catch (error) {
      const message = error instanceof Error ? error.message : "payment flow failed";
      console.error(`[bot:${botConfig.id}] ${message}`);
      await ctx.reply("Não foi possível gerar o pagamento agora. Tente novamente em instantes.");
      logInteraction({ botId: botConfig.id, userId: user.id, type: "message", direction: "outgoing", content: "payment error shown", logPayloads: services.env.logPayloads });
    }
  });
}
