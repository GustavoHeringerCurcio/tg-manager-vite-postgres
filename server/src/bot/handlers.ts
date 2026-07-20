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
import { normalizePaymentFlow } from "./paymentFlow.js";
import type { PaymentFlow } from "./paymentFlow.js";
import { normalizeRemarketing } from "./remarketing.js";

const LIVEPIX_CALLBACK_PREFIX = "livepix_payment:";
const LIVEPIX_VERIFY_PREFIX = "livepix_verify:";
const LIVEPIX_COPY_PREFIX = "livepix_copy:";

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

function findPaymentButtonAcross(steps: MessageStep[][], id: string): MessageButton | undefined {
  for (const flow of steps) {
    const button = findPaymentButton(flow, id);
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

function resolvePlaceholders(text: string, amount: number, pixCode: string | undefined, checkoutUrl: string): string {
  return text
    .replace(/\{amount\}/g, `R$ ${amount.toFixed(2)}`)
    .replace(/\{pix_code\}/g, pixCode ?? "")
    .replace(/\{checkout_url\}/g, checkoutUrl);
}

async function sendLivePixPayment(ctx: Context, botConfig: Bot, user: User, services: HandlerServices, button: MessageButton, paymentFlow: PaymentFlow): Promise<void> {
  const amount = button.price ?? botConfig.checkoutAmount;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { pixGenerations: { increment: 1 }, lastInteraction: new Date() }
    });
    const payment = await services.livePix.createPayment(amount);
    const pixAllowed = updatedUser.pixGenerations <= services.env.maxPixGenerations;
    const pixCode = pixAllowed ? await services.livePix.extractPixCode(payment.checkoutUrl) : undefined;

    await prisma.transaction.create({
      data: {
        botId: botConfig.id,
        userId: user.id,
        amount,
        paymentMethod: PaymentMethod.PIX,
        status: "PENDING",
        pixCode,
        checkoutUrl: payment.checkoutUrl,
        livepixReference: payment.reference
      }
    });

    const steps = paymentFlow.steps;
    if (steps.length > 0) {
      for (const [index, step] of steps.entries()) {
        let resolvedText = step.text ? resolvePlaceholders(step.text, amount, pixCode, payment.checkoutUrl) : undefined;

        if (step.includePixCode && pixCode) {
          resolvedText = resolvedText
            ? `${resolvedText}\n\n<code>${pixCode}</code>`
            : `<code>${pixCode}</code>`;
        }
        if (step.includeCheckoutUrl) {
          resolvedText = resolvedText
            ? `${resolvedText}\n\n${payment.checkoutUrl}`
            : payment.checkoutUrl;
        }

        const resolvedStep: MessageStep = { ...step, text: resolvedText };

        if (step.type === "TEXT" && resolvedText) {
          const replyMarkup = keyboard(resolvedStep);
          const options = replyMarkup ? { reply_markup: replyMarkup as InlineKeyboardMarkup, parse_mode: "HTML" as const } : { parse_mode: "HTML" as const };
          await ctx.reply(resolvedText, options as object);
        } else {
          await sendStep(ctx, botConfig, user, resolvedStep, services.env);
        }

        if (step.includeQrCode && pixCode) {
          try {
            const qrBuffer = await services.livePix.generateQrCode(pixCode);
            await ctx.replyWithPhoto({ source: qrBuffer }, { caption: `QR Code PIX - R$ ${amount.toFixed(2)}` });
          } catch {
            await ctx.reply("QR Code não disponível no momento.");
          }
        }

        if (step.delayMs > 0 && index < steps.length - 1) await delay(step.delayMs);
      }
    } else {
      const defaultText = `Pagamento PIX\n\nValor: R$ ${amount.toFixed(2)}`;
      if (pixCode) {
        await ctx.reply(`${defaultText}\n\nCódigo PIX copia e cola:\n<code>${pixCode}</code>`, { parse_mode: "HTML" });
      } else {
        const paymentReplyMarkup: Keyboard = { inline_keyboard: [[{ text: "Pagar via LivePix", url: payment.checkoutUrl }]] };
        await ctx.reply(`${defaultText}\n\nClique no botão abaixo para pagar.`, { reply_markup: paymentReplyMarkup as InlineKeyboardMarkup });
      }
    }

    const pixCodeBlock = pixCode ? `\n\n<code>${pixCode}</code>` : "";
    const finalText = `Pagamento PIX - R$ ${amount.toFixed(2)}${pixCodeBlock}`;

    const finalButtons: KeyboardButton[][] = [[
      { text: paymentFlow.verifyLabel, callback_data: `${LIVEPIX_VERIFY_PREFIX}${payment.reference}` }
    ]];
    if (pixCode) {
      finalButtons.push([{ text: paymentFlow.pixCopyLabel, callback_data: `livepix_copy:${payment.reference}` }]);
    }
    const finalMarkup: Keyboard = { inline_keyboard: finalButtons };
    await ctx.reply(finalText, { reply_markup: finalMarkup as InlineKeyboardMarkup, parse_mode: "HTML" });

    logInteraction({ botId: botConfig.id, userId: user.id, type: "message", direction: "outgoing", content: "LivePix payment response sent", logPayloads: services.env.logPayloads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment flow failed";
    console.error(`[bot:${botConfig.id}] ${message}`);
    await ctx.reply("Não foi possível gerar o pagamento agora. Tente novamente em instantes.");
    logInteraction({ botId: botConfig.id, userId: user.id, type: "message", direction: "outgoing", content: "payment error shown", logPayloads: services.env.logPayloads });
  }
}

export function registerHandlers(telegraf: Telegraf<Context>, botConfig: Bot, services: HandlerServices): void {
  const messageFlow = normalizeMessageFlow(botConfig.messageFlow);
  const remarketing = normalizeRemarketing(botConfig.remarketing);
  const paymentFlow = normalizePaymentFlow(botConfig.paymentFlow);
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
      if (user && remarketing.enabled && remarketing.messages.length > 0) {
        await prisma.remarketingState.upsert({
          where: { userId_botId: { userId: user.id, botId: botConfig.id } },
          create: {
            botId: botConfig.id,
            userId: user.id,
            nextIndex: 0,
            totalSent: 0,
            nextSendAt: new Date(Date.now() + remarketing.initialDelayMs)
          },
          update: {
            nextIndex: 0,
            totalSent: 0,
            nextSendAt: new Date(Date.now() + remarketing.initialDelayMs)
          }
        });
      }
    } finally {
      activeStarts.delete(chatId);
    }
  });

  telegraf.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";

    if (data.startsWith(LIVEPIX_VERIFY_PREFIX)) {
      const reference = data.slice(LIVEPIX_VERIFY_PREFIX.length);
      await ctx.answerCbQuery("Verificando pagamento...");
      try {
        const payment = await services.livePix.checkPayment(reference);
        if (payment && payment.amount > 0) {
          await ctx.reply(`✅ Pagamento confirmado!\n\nValor: R$ ${(payment.amount / 100).toFixed(2)}\n\nObrigado pela sua compra!`);
          await prisma.transaction.updateMany({
            where: { livepixReference: reference },
            data: { status: "COMPLETED" }
          });
        } else {
          await ctx.answerCbQuery("Pagamento ainda não identificado. Tente novamente após pagar.", { show_alert: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "payment verification failed";
        console.error(`[bot:${botConfig.id}] ${message}`);
        await ctx.answerCbQuery("Falha ao verificar pagamento. Tente novamente.", { show_alert: true });
      }
      return;
    }

    if (data.startsWith(LIVEPIX_COPY_PREFIX)) {
      const reference = data.slice(LIVEPIX_COPY_PREFIX.length);
      await ctx.answerCbQuery("Reenviando código PIX...");
      try {
        const transaction = await prisma.transaction.findFirst({
          where: { livepixReference: reference },
          orderBy: { createdAt: "desc" }
        });
        if (transaction?.pixCode) {
          await ctx.reply(`<code>${transaction.pixCode}</code>`, { parse_mode: "HTML" });
        } else {
          await ctx.answerCbQuery("Código PIX não disponível.", { show_alert: true });
        }
      } catch {
        await ctx.answerCbQuery("Falha ao reenviar código PIX.", { show_alert: true });
      }
      return;
    }

    if (!data.startsWith(LIVEPIX_CALLBACK_PREFIX)) return;
    const buttonId = data.slice(LIVEPIX_CALLBACK_PREFIX.length);
    const button = findPaymentButtonAcross([messageFlow, remarketing.messages], buttonId);
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
    await sendLivePixPayment(ctx, botConfig, user, services, button, paymentFlow);
  });
}
