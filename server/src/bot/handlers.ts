import { logger } from "../utils/logger.js";
import { messagesSent, messagesFailed, paymentsCreated, paymentsConfirmed } from "../utils/metrics.js";
import type { Bot, User } from "@prisma/client";
import { PaymentMethod } from "@prisma/client";
import type { Context, Telegraf } from "telegraf";
import type { InlineKeyboardMarkup, InputMediaPhoto, InputMediaVideo, Message, ParseMode } from "telegraf/types";
import { delay } from "../utils/async.js";
import type { MessageType } from "./messageFlow.js";
import { prisma } from "../services/prisma.js";
import { logInteraction } from "../services/logger.js";
import { scheduleRemarketingJob, cancelRemarketingJob } from "../services/remarketingQueue.js";
import type { AppEnv } from "../utils/env.js";
import { LivePixService } from "../services/livepix.js";
import { BUTTON_STYLE_MAP, getAudioFileId, normalizeMessageFlow } from "./messageFlow.js";
import type { MessageButton, MessageStep } from "./messageFlow.js";
import { normalizePaymentFlow } from "./paymentFlow.js";
import type { PaymentFlow } from "./paymentFlow.js";
import { normalizeRemarketing, normalizeTimeCompliments } from "./remarketing.js";
import type { TimeComplimentConfig } from "./remarketing.js";
import { normalizeBotSettings } from "./botSettings.js";
import { resolveAllPlaceholders, type PaymentContext, formatPixCode } from "./placeholders.js";
import { markdownToHtml } from "../utils/markdownToHtml.js";
import { resolveMediaUrl } from "../utils/media.js";
import { sendPixelEvent } from "../services/facebookPixel.js";

const LIVEPIX_CALLBACK_PREFIX = "livepix_payment:";
const LIVEPIX_VERIFY_PREFIX = "livepix_verify:";
const LIVEPIX_COPY_PREFIX = "livepix_copy:";

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const USER_CACHE_TTL_MS = 60_000;
const USER_CACHE_MAX_SIZE = 10_000;

const userCache = new Map<string, { user: User; timestamp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, { timestamp }] of userCache) {
    if (now - timestamp >= USER_CACHE_TTL_MS) userCache.delete(key);
  }
  if (userCache.size > USER_CACHE_MAX_SIZE) {
    const entries = [...userCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (const [key] of entries.slice(0, userCache.size - USER_CACHE_MAX_SIZE)) {
      userCache.delete(key);
    }
  }
}, 60_000).unref();

function getCachedUser(key: string): User | null {
  const entry = userCache.get(key);
  if (entry && Date.now() - entry.timestamp < USER_CACHE_TTL_MS) return entry.user;
  userCache.delete(key);
  return null;
}

function setCachedUser(key: string, user: User): void {
  userCache.set(key, { user, timestamp: Date.now() });
}

type HandlerServices = {
  env: AppEnv;
  livePix: LivePixService;
};

function textFromMessage(message: Message): string {
  return "text" in message ? message.text : "[non-text message]";
}

type UpsertUserOptions = {
  resetPix?: boolean;
};

async function upsertTelegramUser(botId: string, ctx: Context, options?: UpsertUserOptions): Promise<User | null> {
  if (!ctx.from) return null;
  const telegramId = BigInt(ctx.from.id);
  const cacheKey = `${botId}:${telegramId}`;

  const cached = getCachedUser(cacheKey);
  if (cached) {
    if (options?.resetPix) {
      userCache.delete(cacheKey);
    } else {
      return cached;
    }
  }

  const updateData: Record<string, unknown> = {
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    lastInteraction: new Date()
  };
  if (options?.resetPix) {
    updateData.pixGenerations = 0;
  }

  const createData: Record<string, unknown> = {
    botId,
    telegramId,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    lastInteraction: new Date()
  };
  if (options?.resetPix) {
    createData.pixGenerations = 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await prisma.user.upsert({
    where: { botId_telegramId: { botId, telegramId } },
    create: createData as any,
    update: updateData
  });

  setCachedUser(cacheKey, user);
  return user;
}

async function createOrResumeSession(botId: string, userId: string, stepIndex?: number, options?: { skipUserUpdate?: boolean }): Promise<string> {
  const now = new Date();
  const skipUserUpdate = options?.skipUserUpdate === true;
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
    if (skipUserUpdate) {
      await prisma.userSession.update({ where: { id: existing.id }, data: updateData });
    } else {
      await Promise.all([
        prisma.userSession.update({ where: { id: existing.id }, data: updateData }),
        prisma.user.update({
          where: { id: userId },
          data: { currentSessionId: existing.id, currentStepIndex: stepIndex }
        })
      ]);
    }
    return existing.id;
  }

  const closed = await prisma.userSession.findFirst({
    where: { botId, userId, status: "CLOSED" },
    orderBy: { startedAt: "desc" }
  });
  if (closed) {
    const closedAt = closed.endedAt ?? closed.startedAt;
    if ((now.getTime() - closedAt.getTime()) < SESSION_TIMEOUT_MS) {
      if (skipUserUpdate) {
        await prisma.userSession.update({
          where: { id: closed.id },
          data: { status: "ACTIVE", endedAt: null, messageCount: { increment: 1 }, updatedAt: now }
        });
      } else {
        await Promise.all([
          prisma.userSession.update({
            where: { id: closed.id },
            data: { status: "ACTIVE", endedAt: null, messageCount: { increment: 1 }, updatedAt: now }
          }),
          prisma.user.update({
            where: { id: userId },
            data: { currentSessionId: closed.id, currentStepIndex: stepIndex }
          })
        ]);
      }
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

  if (!skipUserUpdate) {
    await prisma.user.update({
      where: { id: userId },
      data: { currentSessionId: session.id, currentStepIndex: stepIndex }
    });
  }

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

async function sendChatActionRepeatedly(ctx: Context, type: MessageType, delayMs: number): Promise<void> {
  const CHAT_ACTION_INTERVAL_MS = 4000;
  const action = type === "TEXT" ? "typing" : type === "AUDIO" ? "record_voice" : type === "IMAGE" ? "upload_photo" : "upload_video";
  await ctx.sendChatAction(action);
  let elapsed = 0;
  while (elapsed + CHAT_ACTION_INTERVAL_MS < delayMs) {
    await delay(CHAT_ACTION_INTERVAL_MS);
    elapsed += CHAT_ACTION_INTERVAL_MS;
    await ctx.sendChatAction(action);
  }
  const remaining = delayMs - elapsed;
  if (remaining > 0) {
    await delay(remaining);
  }
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
  parseMode?: ParseMode,
  payment?: PaymentContext
): Promise<void> {

  let resolvedText = step.text
    ? resolveAllPlaceholders(step.text, { firstName: user?.firstName ?? null }, timeCompliments, payment)
    : step.text;
  resolvedText = resolvedText ? markdownToHtml(resolvedText) : resolvedText;
  const replyMarkup = keyboard(step);
  const parseOpt = parseMode ? { parse_mode: parseMode } : { parse_mode: "HTML" as const };
  const options = replyMarkup ? { reply_markup: replyMarkup as InlineKeyboardMarkup, ...parseOpt } : parseOpt;
  const chatId = ctx.chat?.id;
  const messageId = ctx.message?.message_id;

  if (step.title) {
    sendPixelEvent(
      botConfig.id, user?.id, ctx.from?.id ? BigInt(ctx.from.id) : undefined,
      ctx.botInfo?.username, botConfig.fbPixelId, botConfig.fbAccessToken, botConfig.fbEnabled,
      {
        eventName: "ViewContent",
        eventTime: Math.floor(Date.now() / 1000),
        userData: { externalId: ctx.from?.id?.toString() ?? "anonymous" },
        customData: { content_name: step.title, content_type: step.type },
        eventSourceUrl: ctx.botInfo?.username ? `https://t.me/${ctx.botInfo.username}` : ""
      }
    );
  }

  if (step.type === "VIDEO" && step.mediaUrls.length > 0) {
    if (step.mediaUrls.length === 1) {
      const resolvedVideo = await resolveMediaUrl(step.mediaUrls[0]);
      await ctx.replyWithVideo(resolvedVideo, { caption: resolvedText, ...(Object.keys(options).length > 0 ? options : {}) });
    } else {
      const resolvedUrls = await Promise.all(step.mediaUrls.map(resolveMediaUrl));
      const mediaGroup: InputMediaVideo[] = resolvedUrls.map((media, i) => ({
        type: "video",
        media,
        ...(i === 0 && resolvedText ? { caption: resolvedText, ...parseOpt } : {})
      }));
      await ctx.replyWithMediaGroup(mediaGroup);
    }
    logInteraction({
      botId: botConfig.id, userId: user?.id, sessionId, type: "message", direction: "outgoing",
      content: `video:${step.title}`, stepIndex, chatId, messageId,
      metadata: {
        mediaType: "VIDEO",
        title: step.title,
        mediaCount: step.mediaUrls.length,
        ...(step.buttons.length > 0 ? {
          buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
        } : {})
      },
      logPayloads: env.logPayloads
    });
    return;
  }
  const audioFileId = step.type === "AUDIO" ? getAudioFileId(step, timeCompliments.timezone) : null;
  if (step.type === "AUDIO" && audioFileId) {
    await ctx.replyWithVoice(audioFileId, { caption: resolvedText, ...(Object.keys(options).length > 0 ? options : {}) });
    logInteraction({
      botId: botConfig.id, userId: user?.id, sessionId, type: "message", direction: "outgoing",
      content: `audio:${step.title}`, stepIndex, chatId, messageId,
      metadata: {
        mediaType: "AUDIO",
        title: step.title,
        ...(step.buttons.length > 0 ? {
          buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
        } : {})
      },
      logPayloads: env.logPayloads
    });
    return;
  }
  if (step.type === "IMAGE" && step.mediaUrls.length > 0) {
    if (step.mediaUrls.length === 1) {
      const resolvedPhoto = await resolveMediaUrl(step.mediaUrls[0]);
      await ctx.replyWithPhoto(resolvedPhoto, { caption: resolvedText, ...(Object.keys(options).length > 0 ? options : {}) });
    } else {
      const resolvedUrls = await Promise.all(step.mediaUrls.map(resolveMediaUrl));
      const mediaGroup: InputMediaPhoto[] = resolvedUrls.map((media, i) => ({
        type: "photo",
        media,
        ...(i === 0 && resolvedText ? { caption: resolvedText, ...parseOpt } : {})
      }));
      await ctx.replyWithMediaGroup(mediaGroup);
    }
    logInteraction({
      botId: botConfig.id, userId: user?.id, sessionId, type: "message", direction: "outgoing",
      content: `image:${step.title}`, stepIndex, chatId, messageId,
      metadata: {
        mediaType: "IMAGE",
        title: step.title,
        mediaCount: step.mediaUrls.length,
        ...(step.buttons.length > 0 ? {
          buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
        } : {})
      },
      logPayloads: env.logPayloads
    });
    return;
  }
  await ctx.reply(resolvedText ?? " ", Object.keys(options).length > 0 ? options : undefined);
  logInteraction({
    botId: botConfig.id, userId: user?.id, sessionId, type: "message", direction: "outgoing",
    content: step.text ?? step.title, stepIndex, chatId, messageId,
    metadata: step.buttons.length > 0 ? {
      buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
    } : undefined,
    logPayloads: env.logPayloads
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function classifyLivePixError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";

  if (name === "TypeError" && /fetch|network|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(message)) {
    return `❌ Erro de conexão com o serviço de pagamento.\nVerifique sua internet e tente novamente.\n\n<code>${escapeHtml(message)}</code>`;
  }
  if (name === "AbortError" || name === "TimeoutError" || /abort|timeout/i.test(message)) {
    return `❌ O serviço de pagamento demorou muito para responder.\nTente novamente em alguns instantes.\n\n<code>${escapeHtml(message)}</code>`;
  }
  if (message.includes("authentication failed")) {
    return `❌ Falha na autenticação com o LivePix.\nErro interno — tente novamente mais tarde.\n\n<code>${escapeHtml(message)}</code>`;
  }
  if (message.includes("authentication response missing")) {
    return `❌ Resposta inválida na autenticação do LivePix.\nErro interno — tente novamente.\n\n<code>${escapeHtml(message)}</code>`;
  }
  if (message.includes("payment creation failed")) {
    const statusMatch = message.match(/status (\d+)/);
    const statusStr = statusMatch ? ` (HTTP ${statusMatch[1]})` : "";
    return `❌ O LivePix recusou a solicitação${statusStr}.\nTente novamente em instantes.\n\n<code>${escapeHtml(message)}</code>`;
  }
  if (message.includes("missing checkout URL")) {
    return `❌ Resposta inválida do LivePix.\nTente novamente.\n\n<code>${escapeHtml(message)}</code>`;
  }
  if (/prisma/i.test(name) || /prisma/i.test(message)) {
    return `❌ Erro ao salvar o pagamento no banco de dados.\nTente novamente.\n\n<code>${escapeHtml(message)}</code>`;
  }
  return `❌ Não foi possível gerar o pagamento.\nTente novamente em instantes.\n\n<code>${escapeHtml(message)}</code>`;
}

export async function cancelRemarketingForUser(botId: string, userId: string): Promise<number> {
  await cancelRemarketingJob(userId, botId);
  const cancelled = await prisma.remarketingState.deleteMany({
    where: { botId, userId }
  });
  if (cancelled.count > 0) {
    logger.info(`[bot:${botId}] cancelled ${cancelled.count} pending remarketing task(s) for user ${userId}`);
  }
  return cancelled.count;
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
    const maxGenerations = normalizeBotSettings(botConfig.settings).maxDailyPixGenerations ?? services.env.maxPixGenerations;
    if (currentCount < maxGenerations) {
      pixCode = await services.livePix.extractPixCode(payment.checkoutUrl);
      if (pixCode) {
        await prisma.user.update({
          where: { id: user.id },
          data: { pixGenerations: { increment: 1 } }
        });
      }
    } else {
      logger.warn(`[bot:${botConfig.id}] user ${user.id} pix limit reached (${currentCount}/${maxGenerations})`);
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

        paymentsCreated.inc({ bot_id: botConfig.id, status: "ok" });

        await incrementUserStats(user.id, "totalPayments", amount);

    sendPixelEvent(
      botConfig.id, user.id, ctx.from?.id ? BigInt(ctx.from.id) : undefined,
      ctx.botInfo?.username, botConfig.fbPixelId, botConfig.fbAccessToken, botConfig.fbEnabled,
      {
        eventName: "AddPaymentInfo",
        eventTime: Math.floor(Date.now() / 1000),
        userData: { externalId: ctx.from?.id?.toString() ?? "anonymous" },
        customData: { currency: "BRL", value: amount, payment_method: "pix" },
        eventSourceUrl: ctx.botInfo?.username ? `https://t.me/${ctx.botInfo.username}` : ""
      }
    );

    // WARNING: These two final buttons are MANDATORY — both always appear and their function
    // MUST NOT be replaced. The "Verify Payment" button is always a callback; the "Copy PIX"
    // button triggers a callback that sends audio (if enabled) and replies with the PIX code
    // alongside a native copy_text button for one-tap copy.
    const finalButtons: KeyboardButton[][] = [[
      { text: paymentFlow.verifyLabel, callback_data: `${LIVEPIX_VERIFY_PREFIX}${payment.reference}` }
    ]];
    const copyText = pixCode ?? payment.checkoutUrl;
    if (copyText) {
      finalButtons.push([{
        text: paymentFlow.pixCopyLabel,
        callback_data: `${LIVEPIX_COPY_PREFIX}${payment.reference}`,
        copy_text: { text: copyText }
      }]);
    }

    function paymentKeyboard(step: MessageStep): Keyboard {
      const stepButtons: KeyboardButton[][] = step.buttons.map((button) => [{
        text: button.label,
        style: BUTTON_STYLE_MAP[button.color],
        ...(button.action === "OPEN_URL" ? { url: button.url } : { callback_data: `${LIVEPIX_CALLBACK_PREFIX}${button.id}` })
      }]);
      return { inline_keyboard: [...stepButtons, ...finalButtons] };
    }

    const steps = paymentFlow.steps;
    if (steps.length > 0) {
      for (const [index, step] of steps.entries()) {
        if (step.chatAction && step.delayMs > 0) {
          await sendChatActionRepeatedly(ctx, step.type, step.delayMs);
        } else if (step.delayMs > 0) {
          await delay(step.delayMs);
        }
        let resolvedText = step.text
          ? resolveAllPlaceholders(step.text, { firstName: user.firstName }, timeCompliments, {
              amount: amount * 100,
              pixCode,
              checkoutUrl: payment.checkoutUrl,
            })
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
        const isLast = index === steps.length - 1;

        if (step.type === "TEXT" && resolvedText) {
          const kb = isLast ? paymentKeyboard(resolvedStep) : keyboard(resolvedStep);
          const options = kb ? { reply_markup: kb as InlineKeyboardMarkup, parse_mode: "HTML" as const } : { parse_mode: "HTML" as const };
          await ctx.reply(resolvedText, options as object);
          logInteraction({
            botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
            content: resolvedText, stepIndex: -1 - index, chatId, messageId,
            metadata: step.buttons.length > 0 ? {
              buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
            } : undefined,
            logPayloads: services.env.logPayloads
          });
        } else if (isLast) {
          const kb = paymentKeyboard(resolvedStep);
          const kbParam = { reply_markup: kb as InlineKeyboardMarkup, parse_mode: "HTML" as const };
          if (resolvedStep.type === "IMAGE" && resolvedStep.mediaUrls.length === 1) {
            const resolvedPhoto = await resolveMediaUrl(resolvedStep.mediaUrls[0]);
            await ctx.replyWithPhoto(resolvedPhoto, { caption: resolvedText ?? undefined, ...kbParam } as object);
            logInteraction({
              botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
              content: `image:${step.title}`, stepIndex: -1 - index, chatId, messageId,
              metadata: {
                mediaType: "IMAGE",
                title: step.title,
                mediaCount: resolvedStep.mediaUrls.length,
                ...(step.buttons.length > 0 ? {
                  buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
                } : {})
              },
              logPayloads: services.env.logPayloads
            });
          } else if (resolvedStep.type === "VIDEO" && resolvedStep.mediaUrls.length === 1) {
            const resolvedVideo = await resolveMediaUrl(resolvedStep.mediaUrls[0]);
            await ctx.replyWithVideo(resolvedVideo, { caption: resolvedText ?? undefined, ...kbParam } as object);
            logInteraction({
              botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
              content: `video:${step.title}`, stepIndex: -1 - index, chatId, messageId,
              metadata: {
                mediaType: "VIDEO",
                title: step.title,
                mediaCount: resolvedStep.mediaUrls.length,
                ...(step.buttons.length > 0 ? {
                  buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
                } : {})
              },
              logPayloads: services.env.logPayloads
            });
          } else if (resolvedStep.type === "AUDIO" && getAudioFileId(resolvedStep, timeCompliments.timezone)) {
            await ctx.replyWithVoice(getAudioFileId(resolvedStep, timeCompliments.timezone)!, { caption: resolvedText ?? undefined, ...kbParam } as object);
            logInteraction({
              botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
              content: `audio:${step.title}`, stepIndex: -1 - index, chatId, messageId,
              metadata: {
                mediaType: "AUDIO",
                title: step.title,
                ...(step.buttons.length > 0 ? {
                  buttons: step.buttons.map((b) => ({ id: b.id, label: b.label, color: b.color, action: b.action, price: b.price }))
                } : {})
              },
              logPayloads: services.env.logPayloads
            });
          } else {
            await sendStep(ctx, botConfig, user, sessionId, resolvedStep, -1 - index, services.env, timeCompliments, "HTML");
          }
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
              metadata: { mediaType: "IMAGE", title: `QR Code - R$ ${amount.toFixed(2)}` },
              logPayloads: services.env.logPayloads
            });
          } catch (error) {
            logger.error(`[bot:${botConfig.id}] QR code generation failed`, error instanceof Error ? error.message : error);
            await ctx.reply("QR Code não disponível no momento.", { parse_mode: "HTML" });
          }
        }
      }
    } else {
      const defaultText = `Pagamento PIX\n\nValor: R$ ${amount.toFixed(2)}`;
      const paymentReplyMarkup: Keyboard = { inline_keyboard: [[{ text: "Pagar via LivePix", url: payment.checkoutUrl }]] };
      await ctx.reply(`${defaultText}\n\nClique no botão abaixo para pagar.`, { reply_markup: paymentReplyMarkup as InlineKeyboardMarkup, parse_mode: "HTML" });
      logInteraction({
        botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
        content: "LivePix payment default", chatId, messageId,
        metadata: {
          buttons: [{ id: "livepix", label: "Pagar via LivePix", color: "BLUE", action: "OPEN_URL" as const }]
        },
        logPayloads: services.env.logPayloads
      });
    }

    logInteraction({
      botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
      content: "LivePix payment response sent", chatId, messageId,
      logPayloads: services.env.logPayloads
    });
  } catch (error) {
    paymentsCreated.inc({ bot_id: botConfig.id, status: "error" });
    const message = error instanceof Error ? error.message : "payment flow failed";
    logger.error(`[bot:${botConfig.id}] ${message}`);
    const userMessage = classifyLivePixError(error);
    await ctx.reply(userMessage, { parse_mode: "HTML" });
    logInteraction({
      botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
      content: `payment error: ${message}`, chatId, messageId,
      logPayloads: services.env.logPayloads
    });
  }
}

export function registerHandlers(telegraf: Telegraf<Context>, botConfig: Bot, services: HandlerServices): void {
  const messageFlow = normalizeMessageFlow(botConfig.messageFlow);
  const remarketing = normalizeRemarketing(botConfig.remarketing);
  const paymentFlow = normalizePaymentFlow(botConfig.paymentFlow);
  const botSettings = normalizeBotSettings(botConfig.settings);
  const botTimezone = botSettings.timezone;
  const timeCompliments = normalizeTimeCompliments(botConfig.timeCompliments, botTimezone);
  const activeStarts = new Set<number>();

  telegraf.start(async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId || activeStarts.has(chatId)) return;
    activeStarts.add(chatId);
    try {
      const shouldResetPix = botSettings.resetPixAfterStart !== false;
      const user = await upsertTelegramUser(botConfig.id, ctx, { resetPix: shouldResetPix });
      if (!user) return;

      if (user.isBlocked) {
        await ctx.reply("Você está bloqueado.", { parse_mode: "HTML" });
        return;
      }

      const isNewUser = user.totalInteractions === 0;
      const pixelEventName = isNewUser ? "CompleteRegistration" : "StartTrial";
      sendPixelEvent(
        botConfig.id, user.id, ctx.from?.id ? BigInt(ctx.from.id) : undefined,
        ctx.botInfo?.username, botConfig.fbPixelId, botConfig.fbAccessToken, botConfig.fbEnabled,
        {
          eventName: pixelEventName,
          eventTime: Math.floor(Date.now() / 1000),
          userData: { externalId: ctx.from?.id?.toString() ?? "anonymous" },
          customData: { status: isNewUser ? "new" : "returning" },
          eventSourceUrl: ctx.botInfo?.username ? `https://t.me/${ctx.botInfo.username}` : ""
        }
      );

      const message = ctx.message ? textFromMessage(ctx.message) : "/start";
      const sessionId = await createOrResumeSession(botConfig.id, user.id, 0, { skipUserUpdate: true });

      logInteraction({
        botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "incoming",
        content: message, stepIndex: 0, chatId, messageId: ctx.message?.message_id,
        payload: services.env.logPayloads ? jsonPayload(ctx.update) : undefined, logPayloads: services.env.logPayloads,
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
        if (step.chatAction && step.delayMs > 0) {
          await sendChatActionRepeatedly(ctx, step.type, step.delayMs);
        } else if (step.delayMs > 0) {
          await delay(step.delayMs);
        }
        await sendStep(ctx, botConfig, user, sessionId, step, index, services.env, timeCompliments);
      }

      const finalStepIndex = messageFlow.length - 1;
      await Promise.all([
        prisma.userSession.update({
          where: { id: sessionId },
          data: { currentStepIndex: finalStepIndex }
        }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            currentSessionId: sessionId,
            currentStepIndex: finalStepIndex,
            totalInteractions: { increment: 1 }
          }
        })
      ]);

      if (user && remarketing.enabled && remarketing.messages.length > 0) {
        const nextSendAt = new Date(Date.now() + remarketing.initialDelayMs);
        await prisma.remarketingState.upsert({
          where: { userId_botId: { userId: user.id, botId: botConfig.id } },
          create: {
            botId: botConfig.id,
            userId: user.id,
            nextIndex: 0,
            totalSent: 0,
            nextSendAt
          },
          update: {
            nextIndex: 0,
            totalSent: 0,
            nextSendAt,
            retries: 0,
            lastError: null
          }
        });
        await scheduleRemarketingJob(user.id, botConfig.id, remarketing.initialDelayMs);
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

    sendPixelEvent(
      botConfig.id, user.id, ctx.from?.id ? BigInt(ctx.from.id) : undefined,
      ctx.botInfo?.username, botConfig.fbPixelId, botConfig.fbAccessToken, botConfig.fbEnabled,
      {
        eventName: "Lead",
        eventTime: Math.floor(Date.now() / 1000),
        userData: { externalId: ctx.from?.id?.toString() ?? "anonymous" },
        customData: { content_type: "text" },
        eventSourceUrl: ctx.botInfo?.username ? `https://t.me/${ctx.botInfo.username}` : ""
      }
    );

    const sessionId = await createOrResumeSession(botConfig.id, user.id);
    await incrementUserStats(user.id, "totalInteractions");

    logInteraction({
      botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "incoming",
      content: messageText, chatId, messageId: ctx.message?.message_id,
      payload: services.env.logPayloads ? jsonPayload(ctx.update) : undefined, logPayloads: services.env.logPayloads
    });
  });

  telegraf.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
    const chatId = ctx.chat?.id;

    if (data.startsWith(LIVEPIX_VERIFY_PREFIX)) {
      const reference = data.slice(LIVEPIX_VERIFY_PREFIX.length);
      try {
        const payment = await services.livePix.checkPayment(reference);
        if (payment && payment.amount != null && payment.amount > 0) {
          const user = await upsertTelegramUser(botConfig.id, ctx);
          await ctx.answerCbQuery();

          const successFlow = paymentFlow.verifyPaymentSuccessFlow ?? [];
          if (successFlow.length > 0) {
            const ptx: PaymentContext = { amount: payment.amount, pixCode: undefined, checkoutUrl: undefined };
            for (const [i, step] of successFlow.entries()) {
              if (step.delayMs > 0) await delay(step.delayMs);
              await sendStep(ctx, botConfig, user, null, step, i, services.env, timeCompliments, undefined, ptx);
            }
          } else {
            await ctx.reply(`✅ Pagamento confirmado!\n\nValor: R$ ${(payment.amount / 100).toFixed(2)}\n\nObrigado pela sua compra!`, { parse_mode: "HTML" });
          }

          await prisma.transaction.updateMany({
            where: { livepixReference: reference },
            data: { status: "COMPLETED" }
          });

          paymentsConfirmed.inc({ bot_id: botConfig.id, source: "callback" });

          if (user) {
            try {
              await cancelRemarketingForUser(botConfig.id, user.id);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              logger.error(
                `[bot:${botConfig.id}] remarketing cancellation failed after payment (userId=${user?.id}, reference=${reference}): ${msg}`
              );
            }
          }
          if (user) {
            const sessionId = await createOrResumeSession(botConfig.id, user.id);

            const deliverables = paymentFlow.deliverables ?? [];
            if (deliverables.length > 0) {
              for (const [index, step] of deliverables.entries()) {
                if (step.delayMs > 0) {
                  await delay(step.delayMs);
                }
                await sendStep(ctx, botConfig, user, sessionId, step, index, services.env, timeCompliments);
              }
            }

            logInteraction({
              botId: botConfig.id, userId: user.id, sessionId, type: "message", direction: "outgoing",
              content: "Payment confirmed", chatId,
              logPayloads: services.env.logPayloads
            });
            sendPixelEvent(
              botConfig.id, user.id, ctx.from?.id ? BigInt(ctx.from.id) : undefined,
              ctx.botInfo?.username, botConfig.fbPixelId, botConfig.fbAccessToken, botConfig.fbEnabled,
              {
                eventName: "Purchase",
                eventTime: Math.floor(Date.now() / 1000),
                userData: { externalId: ctx.from?.id?.toString() ?? "anonymous" },
                customData: { currency: "BRL", value: payment.amount / 100, transaction_id: reference },
                eventSourceUrl: ctx.botInfo?.username ? `https://t.me/${ctx.botInfo.username}` : ""
              }
            );
          }
        } else {
          const failFlow = paymentFlow.verifyPaymentFailFlow ?? [];
          if (failFlow.length > 0) {
            await ctx.answerCbQuery();
            for (const [i, step] of failFlow.entries()) {
              if (step.delayMs > 0) await delay(step.delayMs);
              await sendStep(ctx, botConfig, null, null, step, i, services.env, timeCompliments);
            }
          } else {
            await ctx.reply("❌ Pagamento ainda não identificado. Tente novamente após efetuar o pagamento.", { parse_mode: "HTML" });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "payment verification failed";
        logger.error(`[bot:${botConfig.id}] ${message}`);
        try {
          await ctx.answerCbQuery("Falha ao verificar pagamento. Tente novamente.", { show_alert: true });
        } catch {
          // answerCbQuery may fail if already answered
        }
      }
      return;
    }

    if (data.startsWith(LIVEPIX_COPY_PREFIX)) {
      const reference = data.slice(LIVEPIX_COPY_PREFIX.length);
      try {
        const transaction = await prisma.transaction.findFirst({
          where: { livepixReference: reference },
          select: { pixCode: true, checkoutUrl: true }
        });
        await ctx.answerCbQuery();

        const copyFlow = paymentFlow.copyPixFlow ?? [];
        if (copyFlow.length > 0) {
          const ptx: PaymentContext = {
            pixCode: transaction?.pixCode ?? undefined,
            checkoutUrl: transaction?.checkoutUrl ?? undefined,
          };
          for (const [i, step] of copyFlow.entries()) {
            if (step.delayMs > 0) await delay(step.delayMs);
            await sendStep(ctx, botConfig, null, null, step, i, services.env, timeCompliments, undefined, ptx);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[bot:${botConfig.id}] copy-pix callback failed: ${msg}`);
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
      content: button.label, buttonId, chatId, messageId: ctx.callbackQuery.message?.message_id,
      metadata: {
        buttonLabel: button.label,
        buttonColor: button.color,
        buttonAction: button.action,
        buttonPrice: button.price,
      },
      payload: services.env.logPayloads ? jsonPayload(ctx.update) : undefined, logPayloads: services.env.logPayloads
    });

    sendPixelEvent(
      botConfig.id, user.id, ctx.from?.id ? BigInt(ctx.from.id) : undefined,
      ctx.botInfo?.username, botConfig.fbPixelId, botConfig.fbAccessToken, botConfig.fbEnabled,
      {
        eventName: "InitiateCheckout",
        eventTime: Math.floor(Date.now() / 1000),
        userData: { externalId: ctx.from?.id?.toString() ?? "anonymous" },
        customData: { currency: "BRL", value: button.price, content_name: button.label },
        eventSourceUrl: ctx.botInfo?.username ? `https://t.me/${ctx.botInfo.username}` : ""
      }
    );

    await sendLivePixPayment(ctx, botConfig, user, sessionId, services, button, paymentFlow, timeCompliments);
  });
}
