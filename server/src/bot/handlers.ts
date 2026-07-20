import type { Bot, User } from "@prisma/client";
import { PaymentMethod } from "@prisma/client";
import type { Context, Telegraf } from "telegraf";
import type { InlineKeyboardMarkup, InputMediaVideo, Message, ParseMode } from "telegraf/types";
import { delay } from "../utils/async.js";
import { prisma } from "../services/prisma.js";
import { logInteraction } from "../services/logger.js";
import type { AppEnv } from "../utils/env.js";
import { LivePixService } from "../services/livepix.js";
import { BUTTON_STYLE_MAP, getAudioFileId, normalizeMessageFlow } from "./messageFlow.js";
import type { MessageButton, MessageStep } from "./messageFlow.js";
import { normalizePaymentFlow } from "./paymentFlow.js";
import type { PaymentFlow } from "./paymentFlow.js";
import { normalizeRemarketing, normalizeTimeCompliments } from "./remarketing.js";
import type { TimeComplimentConfig } from "./remarketing.js";
import { resolveAllPlaceholders } from "./placeholders.js";
import { markdownToHtml } from "../utils/markdownToHtml.js";

const LIVEPIX_CALLBACK_PREFIX = "livepix_payment:";
const LIVEPIX_VERIFY_PREFIX = "livepix_verify:";

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

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

async function createOrResumeSession(botId: string, userId: string, stepIndex?: number): Promise<string> {
  const now = new Date();
  const existing = await prisma.userSession.findFirst({
    where: { botId, userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" }
  });

  if (existing) {
    const updateData: Record<string, unknown> = { messageCount: { increment: 1 }, updatedAt: now };
    if (stepIndex !== undefined) {
      updateData.currentStepIndex = stepIndex;
      const steps = (existing.stepsCompleted as number[]) ?? [];
      if (!steps.includes(stepIndex)) {
        updateData.stepsCompleted = [...steps, stepIndex];
      }
    }
    await prisma.userSession.update({ where: { id: existing.id }, data: updateData });
    await prisma.user.update({
      where: { id: userId },
      data: { currentSessionId: existing.id, currentStepIndex: stepIndex }
    });
    return existing.id;
  }

  const closed = await prisma.userSession.findFirst({
    where: { botId, userId, status: "CLOSED" },
    orderBy: { startedAt: "desc" }
  });
  if (closed) {
    const closedAt = closed.endedAt ?? closed.startedAt;
    if ((now.getTime() - closedAt.getTime()) < SESSION_TIMEOUT_MS) {
      await prisma.userSession.update({
        where: { id: closed.id },
        data: { status: "ACTIVE", endedAt: null, messageCount: { increment: 1 }, updatedAt: now }
      });
      await prisma.user.update({
        where: { id: userId },
        data: { currentSessionId: closed.id, currentStepIndex: stepIndex }
      });
      return closed.id;
    }
  }

  await prisma.userSession.updateMany({
    where: { botId, userId, status: "ACTIVE" },
    data: { status: "CLOSED", endedAt: now }
  });

  const session = await prisma.userSession.create({
    data: {
      botId,
      userId,
      status: "ACTIVE",
      currentStepIndex: stepIndex,
      stepsCompleted: stepIndex !== undefined ? [stepIndex] : [],
      messageCount: 1,
      metadata: {}
    }
  });

  await prisma.user.update({
    where: { id: userId },
    data: { currentSessionId: session.id, currentStepIndex: stepIndex }
  });

  return session.id;
}

async function incrementUserStats(userId: string, field: "totalInteractions" | "totalPayments", amountDelta?: number): Promise<void> {
  const data: Record<string, unknown> = { [field]: { increment: 1 } };
  if (field === "totalPayments" && amountDelta) {
    data.totalAmount = { increment: amountDelta };
  }
  await prisma.user.update({ where: { id: userId }, data }).catch(() => {});
}

type KeyboardButton = { text: string; style?: string; callback_data?: string; url?: string; copy_text?: { text: string } };
type Keyboard = { inline_keyboard: KeyboardButton[][] };

function jsonPayload(value: object): object {
  return JSON.parse(JSON.stringify(value)) as object;
}

function keyboard(step: MessageStep): Keyboard | undefined {
  if (step.buttons.length === 0) return undefined;
  return {
    inline_keyboard: step.buttons.map((button) => [{
      text: button.label,
      style: BUTTON_STYLE_MAP[button.color],
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

async function sendStep(
  ctx: Context,
  botConfig: Bot,
  user: User | null,
  sessionId: string | null,
  step: MessageStep,
  stepIndex: number,
  env: AppEnv,
  timeCompliments: TimeComplimentConfig,
  parseMode?: ParseMode
): Promise<void> {
  let resolvedText = step.text
    ? resolveAllPlaceholders(step.text, { firstName: user?.firstName ?? null }, timeCompliments)
    : step.text;
  resolvedText = resolvedText ? markdownToHtml(resolvedText) : resolvedText;
  const replyMarkup = keyboard(step);
  const parseOpt = parseMode ? { parse_mode: parseMode } : { parse_mode: "HTML" as const };
  const options = replyMarkup ? { reply_markup: replyMarkup as InlineKeyboardMarkup, ...parseOpt } : parseOpt;
  const chatId = ctx.chat?.id;
  const messageId = ctx.message?.message_id;

  if (step.type === "VIDEO" && step.mediaUrls.length > 0) {
    if (step.mediaUrls.length === 1) {
      await ctx.replyWithVideo(step.mediaUrls[0], { caption: resolvedText, ...(Object.keys(options).length > 0 ? options : {}) });
    } else {
      const mediaGroup: InputMediaVideo[] = step.mediaUrls.map((url, i) => ({
        type: "video",
        media: url,
        ...(i === 0 && resolvedText ? { caption: resolvedText, ...parseOpt } : {})
      }));
      await ctx.replyWithMediaGroup(mediaGroup);
    }
    logInteraction({
      botId: botConfig.id, userId: user?.id, sessionId, type: "message", direction: "outgoing",
      content: `video:${step.title}`, stepIndex, chatId, messageId,
      logPayloads: env.logPayloads
    });
    return;
  }
  if (step.type === "AUDIO" && step.mediaUrls.length > 0) {
    await ctx.replyWithVoice(getAudioFileId(step)!, { caption: resolvedText, ...(Object.keys(options).length > 0 ? options : {}) });
    logInteraction({
      botId: botConfig.id, userId: user?.id, sessionId, type: "message", direction: "outgoing",
      content: `audio:${step.title}`, stepIndex, chatId, messageId,
      logPayloads: env.logPayloads
    });
    return;
  }
  await ctx.reply(resolvedText ?? " ", Object.keys(options).length > 0 ? options : undefined);
  logInteraction({
    botId: botConfig.id, userId: user?.id, sessionId, type: "message", direction: "outgoing",
    content: step.text ?? step.title, stepIndex, chatId, messageId,
    logPayloads: env.logPayloads
  });
}

function formatPixCode(pixCode: string): string {
  return `<blockquote><code>${pixCode}</code></blockquote>`;
}

function resolvePlaceholders(text: string, amount: number, pixCode: string | undefined, checkoutUrl: string): string {
  return text
    .replace(/\{amount\}/g, `R$ ${amount.toFixed(2)}`)
    .replace(/\{pix_code\}/g, pixCode ? formatPixCode(pixCode) : "")
    .replace(/\{checkout_url\}/g, checkoutUrl);
}

async function sendLivePixPayment(
  ctx: Context,
  botConfig: Bot,
  user: User,
  sessionId: string,
  services: HandlerServices,
  button: MessageButton,
  paymentFlow: PaymentFlow,
  timeCompliments: TimeComplimentConfig
): Promise<void> {
  const amount = button.price!;
  const chatId = ctx.chat?.id;
  const messageId = ctx.message?.message_id;
  try {
    const botUsername = ctx.botInfo?.username;
    const redirectUrl = botUsername ? `https://t.me/${botUsername}` : undefined;
    const payment = await services.livePix.createPayment(amount, redirectUrl);

    let pixCode: string | undefined;
    const currentCount = user.pixGenerations;
    if (currentCount < services.env.maxPixGenerations) {
      pixCode = await services.livePix.extractPixCode(payment.checkoutUrl);
      if (pixCode) {
        await prisma.user.update({
          where: { id: user.id },
          data: { pixGenerations: { increment: 1 } }
        });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastInteraction: new Date() }
    });

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

    await incrementUserStats(user.id, "totalPayments", amount);

    const steps = paymentFlow.steps;
    if (steps.length > 0) {
      for (const [index, step] of steps.entries()) {
        let resolvedText = step.text ? resolvePlaceholders(step.text, amount, pixCode, payment.checkoutUrl) : undefined;
        resolvedText = resolvedText
          ? resolveAllPlaceholders(resolvedText, { firstName: user.firstName }, timeCompliments)
          : undefined;
        resolvedText = resolvedText ? markdownToHtml(resolvedText) : resolvedText;

        if (step.includePixCode && pixCode) {
          const formattedCode = formatPixCode(pixCode);
          resolvedText = resolvedText
            ? `${resolvedText}\n\n${formattedCode}`
            : formattedCode;
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
          logInteraction({
            botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
            content: resolvedText, stepIndex: -1 - index, chatId, messageId,
            logPayloads: services.env.logPayloads
          });
        } else {
          await sendStep(ctx, botConfig, user, sessionId, resolvedStep, -1 - index, services.env, timeCompliments, "HTML");
        }

        if (step.includeQrCode && pixCode) {
          try {
            const qrBuffer = await services.livePix.generateQrCode(pixCode);
            await ctx.replyWithPhoto({ source: qrBuffer }, { caption: `QR Code PIX - R$ ${amount.toFixed(2)}`, parse_mode: "HTML" });
            logInteraction({
              botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
              content: "qr_code", stepIndex: -1 - index, chatId, messageId,
              logPayloads: services.env.logPayloads
            });
          } catch (error) {
            console.error(`[bot:${botConfig.id}] QR code generation failed`, error instanceof Error ? error.message : error);
            await ctx.reply("QR Code não disponível no momento.", { parse_mode: "HTML" });
          }
        }

        if (step.delayMs > 0 && index < steps.length - 1) await delay(step.delayMs);
      }
    } else {
      const defaultText = `Pagamento PIX\n\nValor: R$ ${amount.toFixed(2)}`;
      if (pixCode) {
        await ctx.reply(`${defaultText}\n\nCódigo PIX copia e cola:\n${formatPixCode(pixCode)}`, { parse_mode: "HTML" });
      } else {
        const paymentReplyMarkup: Keyboard = { inline_keyboard: [[{ text: "Pagar via LivePix", url: payment.checkoutUrl }]] };
        await ctx.reply(`${defaultText}\n\nClique no botão abaixo para pagar.`, { reply_markup: paymentReplyMarkup as InlineKeyboardMarkup, parse_mode: "HTML" });
      }
      logInteraction({
        botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
        content: "LivePix payment default", chatId, messageId,
        logPayloads: services.env.logPayloads
      });
    }

    const pixCodeBlock = pixCode ? `\n\n${formatPixCode(pixCode)}` : "";
    const finalText = `Pagamento PIX - R$ ${amount.toFixed(2)}${pixCodeBlock}`;

    const finalButtons: KeyboardButton[][] = [[
      { text: paymentFlow.verifyLabel, callback_data: `${LIVEPIX_VERIFY_PREFIX}${payment.reference}` }
    ]];
    if (pixCode) {
      finalButtons.push([{ text: paymentFlow.pixCopyLabel, copy_text: { text: pixCode } }]);
    }
    const finalMarkup: Keyboard = { inline_keyboard: finalButtons };
    await ctx.reply(finalText, { reply_markup: finalMarkup as InlineKeyboardMarkup, parse_mode: "HTML" });

    logInteraction({
      botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
      content: "LivePix payment response sent", chatId, messageId,
      logPayloads: services.env.logPayloads
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment flow failed";
    console.error(`[bot:${botConfig.id}] ${message}`);
    await ctx.reply("Não foi possível gerar o pagamento agora. Tente novamente em instantes.", { parse_mode: "HTML" });
    logInteraction({
      botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
      content: "payment error shown", chatId, messageId,
      logPayloads: services.env.logPayloads
    });
  }
}

export function registerHandlers(telegraf: Telegraf<Context>, botConfig: Bot, services: HandlerServices): void {
  const messageFlow = normalizeMessageFlow(botConfig.messageFlow);
  const remarketing = normalizeRemarketing(botConfig.remarketing);
  const paymentFlow = normalizePaymentFlow(botConfig.paymentFlow);
  const timeCompliments = normalizeTimeCompliments(botConfig.timeCompliments);
  const activeStarts = new Set<number>();

  telegraf.start(async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || activeStarts.has(chatId)) return;
    activeStarts.add(chatId);
    try {
      const user = await upsertTelegramUser(botConfig.id, ctx);
      if (!user) return;

      if (user.isBlocked) {
        await ctx.reply("Você está bloqueado.", { parse_mode: "HTML" });
        return;
      }

      const message = ctx.message ? textFromMessage(ctx.message) : "/start";
      const sessionId = await createOrResumeSession(botConfig.id, user.id, 0);
      await incrementUserStats(user.id, "totalInteractions");

      logInteraction({
        botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "incoming",
        content: message, stepIndex: 0, chatId, messageId: ctx.message?.message_id,
        payload: jsonPayload(ctx.update), logPayloads: services.env.logPayloads,
        metadata: { isStart: true }
      });

      if (messageFlow.length === 0) {
        await ctx.reply("Nenhuma mensagem configurada para este bot.", { parse_mode: "HTML" });
        logInteraction({
          botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
          content: "empty message flow", stepIndex: 0, chatId, messageId: ctx.message?.message_id,
          logPayloads: services.env.logPayloads
        });
        return;
      }

      for (const [index, step] of messageFlow.entries()) {
        await sendStep(ctx, botConfig, user, sessionId, step, index, services.env, timeCompliments);
        if (step.delayMs > 0 && index < messageFlow.length - 1) await delay(step.delayMs);
      }

      await prisma.userSession.update({
        where: { id: sessionId },
        data: { currentStepIndex: messageFlow.length - 1 }
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { currentStepIndex: messageFlow.length - 1 }
      });

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

  telegraf.on("text", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const messageText = ctx.message ? textFromMessage(ctx.message) : "";
    if (messageText.startsWith("/start")) return;

    const user = await upsertTelegramUser(botConfig.id, ctx);
    if (!user) return;

    if (user.isBlocked) return;

    const sessionId = await createOrResumeSession(botConfig.id, user.id);
    await incrementUserStats(user.id, "totalInteractions");

    logInteraction({
      botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "incoming",
      content: messageText, chatId, messageId: ctx.message?.message_id,
      payload: jsonPayload(ctx.update), logPayloads: services.env.logPayloads
    });
  });

  telegraf.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
    const chatId = ctx.chat?.id;

    if (data.startsWith(LIVEPIX_VERIFY_PREFIX)) {
      const reference = data.slice(LIVEPIX_VERIFY_PREFIX.length);
      await ctx.answerCbQuery("Verificando pagamento...");
      try {
        const payment = await services.livePix.checkPayment(reference);
        if (payment && payment.amount != null && payment.amount > 0) {
          await ctx.reply(`✅ Pagamento confirmado!\n\nValor: R$ ${(payment.amount / 100).toFixed(2)}\n\nObrigado pela sua compra!`, { parse_mode: "HTML" });
          await prisma.transaction.updateMany({
            where: { livepixReference: reference },
            data: { status: "COMPLETED" }
          });
          const user = await upsertTelegramUser(botConfig.id, ctx);
          if (user) {
            const sessionId = await createOrResumeSession(botConfig.id, user.id);
            logInteraction({
              botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
              content: "Payment confirmed", chatId,
              logPayloads: services.env.logPayloads
            });
          }
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

    if (!data.startsWith(LIVEPIX_CALLBACK_PREFIX)) return;
    const rest = data.slice(LIVEPIX_CALLBACK_PREFIX.length);
    const colonIndex = rest.lastIndexOf(":");
    let buttonId: string;
    let priceOverride: number | undefined;
    if (colonIndex > 0) {
      buttonId = rest.slice(0, colonIndex);
      const priceCents = Number(rest.slice(colonIndex + 1));
      if (Number.isFinite(priceCents) && priceCents > 0) {
        priceOverride = priceCents / 100;
      }
    } else {
      buttonId = rest;
    }
    const foundButton = findPaymentButtonAcross([messageFlow, remarketing.messages], buttonId);
    if (!foundButton) {
      await ctx.answerCbQuery("Este botão não está mais disponível.");
      return;
    }
    const button: MessageButton = priceOverride != null
      ? { ...foundButton, price: priceOverride }
      : foundButton;
    await ctx.answerCbQuery("Gerando pagamento...");
    const user = await upsertTelegramUser(botConfig.id, ctx);
    if (!user) {
      await ctx.reply("Não foi possível identificar seu usuário. Tente novamente.", { parse_mode: "HTML" });
      return;
    }
    if (user.isBlocked) return;

    const sessionId = await createOrResumeSession(botConfig.id, user.id);
    await incrementUserStats(user.id, "totalInteractions");

    logInteraction({
      botId: botConfig.id, userId: user.id, sessionId, type: "callback_query", direction: "incoming",
      content: data, buttonId, chatId, messageId: ctx.callbackQuery.message?.message_id,
      payload: jsonPayload(ctx.update), logPayloads: services.env.logPayloads
    });

    await sendLivePixPayment(ctx, botConfig, user, sessionId, services, button, paymentFlow, timeCompliments);
  });
}
