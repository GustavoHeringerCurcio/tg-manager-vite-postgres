import type { Bot, RemarketingState } from "@prisma/client";
import { BotStatus } from "@prisma/client";
import type { Telegram } from "telegraf";
import type { InputMediaPhoto, InputMediaVideo, InlineKeyboardMarkup } from "telegraf/types";
import type { MessageStep } from "../bot/messageFlow.js";
import { BUTTON_STYLE_MAP, getAudioFileId } from "../bot/messageFlow.js";
import { normalizeRemarketing, getDiscountPercentage, resolveDiscountLabel, normalizeTimeCompliments } from "../bot/remarketing.js";
import type { TimeComplimentConfig } from "../bot/remarketing.js";
import { resolveAllPlaceholders } from "../bot/placeholders.js";
import { markdownToHtml } from "../utils/markdownToHtml.js";
import { resolveMediaUrl } from "../utils/media.js";
import { getBotManager } from "./botRegistry.js";
import { logInteraction } from "./logger.js";
import { prisma } from "./prisma.js";

let pollerInterval: ReturnType<typeof setInterval> | null = null;

export function startRemarketingPoller(): void {
  if (pollerInterval) return;
  pollerInterval = setInterval(() => {
    try {
      void processRemarketingBatch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "remarketing tick failed";
      console.error(`[remarketing] ${message}`);
    }
  }, 30_000);
}

export function stopRemarketingPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}

async function processRemarketingBatch(): Promise<void> {
  try {
    const now = new Date();
    const dueStates = await prisma.remarketingState.findMany({
      where: {
        nextSendAt: { lte: now },
        bot: { status: BotStatus.ACTIVE }
      },
      include: { user: true, bot: true },
      orderBy: { nextSendAt: "asc" },
      take: 100
    });

    for (const state of dueStates) {
      try {
        await processOne(state, state.bot, state.user.telegramId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "remarketing send failed";
        console.error(`[remarketing:${state.botId}] ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "remarketing poller batch failed";
    console.error(`[remarketing] ${message}`);
  }
}

async function processOne(
  state: RemarketingState & { bot: Bot; user: { telegramId: bigint; firstName: string | null } },
  botConfig: Bot,
  telegramId: bigint
): Promise<void> {
  if (!state.nextSendAt) return;

  const config = normalizeRemarketing(botConfig.remarketing);
  if (!config.enabled || config.messages.length === 0) {
    await prisma.remarketingState.delete({ where: { id: state.id } }).catch(() => {});
    return;
  }

  const now = Date.now();
  const staleThreshold = config.intervalMs * 2;
  if (now - state.nextSendAt.getTime() > staleThreshold) {
    const newTotalSent = state.totalSent + 1;
    const newNextIndex = (state.nextIndex + 1) % config.messages.length;
    if (config.maxSends > 0 && newTotalSent >= config.maxSends) {
      await prisma.remarketingState.delete({ where: { id: state.id } });
      return;
    }
    await prisma.remarketingState.update({
      where: { id: state.id },
      data: {
        nextIndex: newNextIndex,
        totalSent: newTotalSent,
        nextSendAt: new Date(now + config.intervalMs)
      }
    });
    console.warn(`[remarketing:${state.botId}] skipped stale message (nextSendAt was ${state.nextSendAt.toISOString()}), advancing to next interval`);
    return;
  }

  const manager = getBotManager(state.botId);
  if (!manager) return;

  const timeCompliments = normalizeTimeCompliments(botConfig.timeCompliments);

  const index = state.nextIndex % config.messages.length;
  const step = config.messages[index];
  if (!step) return;

  const discountPercentage = getDiscountPercentage(config.discountOffer, state.totalSent);
  const applyDiscount = discountPercentage > 0;

  const chatId = String(telegramId);
  try {
    await sendRemarketingStep(manager.telegram, chatId, step, state.botId, state.userId, state.user.firstName, timeCompliments, applyDiscount, discountPercentage, config.discountOffer.labelTemplate);
  } catch (error) {
    const message = error instanceof Error ? error.message : "remarketing send failed";
    console.error(`[remarketing:${state.botId}] ${message}`);
    throw error;
  }

  const newTotalSent = state.totalSent + 1;
  const newNextIndex = (state.nextIndex + 1) % config.messages.length;

  if (config.maxSends > 0 && newTotalSent >= config.maxSends) {
    await prisma.remarketingState.delete({ where: { id: state.id } });
    return;
  }

  await prisma.remarketingState.update({
    where: { id: state.id },
    data: {
      nextIndex: newNextIndex,
      totalSent: newTotalSent,
      nextSendAt: new Date(Date.now() + config.intervalMs)
    }
  });
}

async function sendRemarketingStep(
  telegram: Telegram,
  chatId: string | number,
  step: MessageStep,
  botId: string,
  userId: string | null,
  firstName: string | null,
  timeCompliments: TimeComplimentConfig,
  applyDiscount: boolean = false,
  discountPercentage: number = 0,
  labelTemplate: string = ""
): Promise<void> {
  const withTimeout = <T>(p: Promise<T>, ms = 10000) =>
    Promise.race<T>([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("telegram request timed out")), ms))]);

  if (step.chatAction) {
    const action = step.type === "TEXT" ? "typing" : step.type === "AUDIO" ? "record_voice" : step.type === "IMAGE" ? "upload_photo" : "upload_video";
    await withTimeout(telegram.sendChatAction(chatId, action), 10000);
  }

  const resolvedText = step.text
    ? markdownToHtml(resolveAllPlaceholders(step.text, { firstName }, timeCompliments))
    : step.text;
  const replyMarkup = buildInlineKeyboard(step, applyDiscount, discountPercentage, labelTemplate, firstName, timeCompliments.timezone);
  const options = replyMarkup ? { reply_markup: replyMarkup as InlineKeyboardMarkup, parse_mode: "HTML" as const } : { parse_mode: "HTML" as const };

  if (step.type === "VIDEO" && step.mediaUrls.length > 0) {
    if (step.mediaUrls.length === 1) {
      const resolvedVideo = await resolveMediaUrl(step.mediaUrls[0]);
      await withTimeout(telegram.sendVideo(chatId, resolvedVideo, { caption: resolvedText, ...options }), 10000);
    } else {
      const resolvedUrls = await Promise.all(step.mediaUrls.map(resolveMediaUrl));
      const mediaGroup: InputMediaVideo[] = resolvedUrls.map((media, i) => ({
        type: "video" as const,
        media,
        ...(i === 0 && resolvedText ? { caption: resolvedText } : {})
      }));
      await withTimeout((telegram as any).sendMediaGroup(chatId, mediaGroup), 10000);
    }
    logInteraction({ botId, userId, type: "message", direction: "outgoing", content: `remarketing:${step.title}`, logPayloads: false });
    return;
  }

  const remarketingAudioFileId = step.type === "AUDIO" ? getAudioFileId(step) : null;
  if (step.type === "AUDIO" && remarketingAudioFileId) {
    await withTimeout(telegram.sendAudio(chatId, remarketingAudioFileId, { caption: resolvedText, ...options }), 10000);
    logInteraction({ botId, userId, type: "message", direction: "outgoing", content: `remarketing:${step.title}`, logPayloads: false });
    return;
  }

  if (step.type === "IMAGE" && step.mediaUrls.length > 0) {
    if (step.mediaUrls.length === 1) {
      const resolvedPhoto = await resolveMediaUrl(step.mediaUrls[0]);
      await withTimeout(telegram.sendPhoto(chatId, resolvedPhoto, { caption: resolvedText, ...options }), 10000);
    } else {
      const resolvedUrls = await Promise.all(step.mediaUrls.map(resolveMediaUrl));
      const mediaGroup: InputMediaPhoto[] = resolvedUrls.map((media, i) => ({
        type: "photo" as const,
        media,
        ...(i === 0 && resolvedText ? { caption: resolvedText } : {})
      }));
      await withTimeout((telegram as any).sendMediaGroup(chatId, mediaGroup), 10000);
    }
    logInteraction({ botId, userId, type: "message", direction: "outgoing", content: `remarketing:${step.title}`, logPayloads: false });
    return;
  }

  await withTimeout(telegram.sendMessage(chatId, resolvedText ?? " ", options), 10000);
  logInteraction({ botId, userId, type: "message", direction: "outgoing", content: resolvedText ?? step.title, logPayloads: false });
}

function buildInlineKeyboard(
  step: MessageStep,
  applyDiscount: boolean = false,
  discountPercentage: number = 0,
  labelTemplate: string = "",
  firstName: string | null = null,
  timezone: string = "America/Sao_Paulo"
): { inline_keyboard: Array<Array<{ text: string; style?: string; callback_data?: string; url?: string }>> } | undefined {
  if (step.buttons.length === 0) return undefined;
  return {
    inline_keyboard: step.buttons.map((button) => {
      if (applyDiscount && button.action === "LIVEPIX_PAYMENT" && button.price != null && button.price > 0) {
        const discounted = Math.round(button.price * (1 - discountPercentage / 100) * 100) / 100;
        const cents = Math.round(discounted * 100);
        const labelText = resolveDiscountLabel(labelTemplate || "{label} - R${discount_price} ({discount_percentage}% OFF)", {
          label: button.label,
          originalPrice: button.price,
          discountedPrice: discounted,
          discountPercentage,
          firstName,
          timezone
        });
        return [{
          text: labelText,
          style: BUTTON_STYLE_MAP[button.color],
          callback_data: `livepix_payment:${button.id}:${cents}`
        }];
      }
      return [{
        text: button.label,
        style: BUTTON_STYLE_MAP[button.color],
        ...(button.action === "OPEN_URL" ? { url: button.url } : { callback_data: `livepix_payment:${button.id}` })
      }];
    })
  };
}
