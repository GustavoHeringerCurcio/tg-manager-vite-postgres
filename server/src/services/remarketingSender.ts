import type { Telegram } from "telegraf";
import type { InputMediaPhoto, InputMediaVideo, InlineKeyboardMarkup } from "telegraf/types";
import type { MessageStep } from "../bot/messageFlow.js";
import { BUTTON_STYLE_MAP, getAudioFileId } from "../bot/messageFlow.js";
import { resolveDiscountLabel } from "../bot/remarketing.js";
import type { TimeComplimentConfig } from "../bot/remarketing.js";
import { resolveAllPlaceholders } from "../bot/placeholders.js";
import { markdownToHtml } from "../utils/markdownToHtml.js";
import { resolveMediaUrl } from "../utils/media.js";
import { delay } from "../utils/async.js";
import { logInteraction } from "./logger.js";

export type RemarketingSendContext = {
  telegram: Telegram;
  chatId: string | number;
  step: MessageStep;
  botId: string;
  userId: string | null;
  sessionId: string | null;
  firstName: string | null;
  timeCompliments: TimeComplimentConfig;
  applyDiscount: boolean;
  discountPercentage: number;
  labelTemplate: string;
  showOriginalPrice: boolean;
};

function discountButtonMeta(
  step: MessageStep,
  applyDiscount: boolean,
  discountPercentage: number
) {
  if (step.buttons.length === 0) return undefined;
  return step.buttons.map((b) => {
    if (applyDiscount && b.action === "LIVEPIX_PAYMENT" && b.price != null && b.price > 0) {
      const discounted = Math.round(b.price * (1 - discountPercentage / 100) * 100) / 100;
      return { id: b.id, label: b.label, color: b.color, action: b.action, originalPrice: b.price, discountedPrice: discounted, discountPercentage };
    }
    return { id: b.id, label: b.label, color: b.color, action: b.action, price: b.price };
  });
}

export function buildInlineKeyboard(
  step: MessageStep,
  applyDiscount: boolean = false,
  discountPercentage: number = 0,
  labelTemplate: string = "",
  firstName: string | null = null,
  timezone: string,
  showOriginalPrice: boolean = true
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
        }, showOriginalPrice);
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

export async function sendRemarketingStep(ctx: RemarketingSendContext): Promise<void> {
  const withTimeout = <T>(p: Promise<T>, ms = 10000) =>
    Promise.race<T>([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("telegram request timed out")), ms))]);

  if (ctx.step.chatAction) {
    const CHAT_ACTION_INTERVAL_MS = 4000;
    const action = ctx.step.type === "TEXT" ? "typing" as const
      : ctx.step.type === "AUDIO" ? "record_voice" as const
      : ctx.step.type === "IMAGE" ? "upload_photo" as const
      : "upload_video" as const;

    if (ctx.step.delayMs > 0) {
      await withTimeout(ctx.telegram.sendChatAction(ctx.chatId, action), 10000);
      let elapsed = 0;
      while (elapsed + CHAT_ACTION_INTERVAL_MS < ctx.step.delayMs) {
        await delay(CHAT_ACTION_INTERVAL_MS);
        elapsed += CHAT_ACTION_INTERVAL_MS;
        await withTimeout(ctx.telegram.sendChatAction(ctx.chatId, action), 10000);
      }
      const remaining = ctx.step.delayMs - elapsed;
      if (remaining > 0) {
        await delay(remaining);
      }
    } else {
      await withTimeout(ctx.telegram.sendChatAction(ctx.chatId, action), 10000);
    }
  }

  const resolvedText = ctx.step.text
    ? markdownToHtml(resolveAllPlaceholders(ctx.step.text, { firstName: ctx.firstName }, ctx.timeCompliments))
    : ctx.step.text;
  const replyMarkup = buildInlineKeyboard(
    ctx.step, ctx.applyDiscount, ctx.discountPercentage,
    ctx.labelTemplate, ctx.firstName, ctx.timeCompliments.timezone, ctx.showOriginalPrice
  );
  const options = replyMarkup
    ? { reply_markup: replyMarkup as InlineKeyboardMarkup, parse_mode: "HTML" as const }
    : { parse_mode: "HTML" as const };

  const buttonsMeta = discountButtonMeta(ctx.step, ctx.applyDiscount, ctx.discountPercentage);
  const logMeta = {
    isRemarketing: true,
    ...(ctx.applyDiscount ? { discountPercentage: ctx.discountPercentage } : {}),
    ...(buttonsMeta ? { buttons: buttonsMeta } : {})
  };

  if (ctx.step.type === "VIDEO" && ctx.step.mediaUrls.length > 0) {
    if (ctx.step.mediaUrls.length === 1) {
      const resolvedVideo = await resolveMediaUrl(ctx.step.mediaUrls[0]);
      await withTimeout(ctx.telegram.sendVideo(ctx.chatId, resolvedVideo, { caption: resolvedText, ...options }), 10000);
    } else {
      const resolvedUrls = await Promise.all(ctx.step.mediaUrls.map(resolveMediaUrl));
      const mediaGroup: InputMediaVideo[] = resolvedUrls.map((media, i) => ({
        type: "video" as const,
        media,
        ...(i === 0 && resolvedText ? { caption: resolvedText } : {})
      }));
      await withTimeout((ctx.telegram as any).sendMediaGroup(ctx.chatId, mediaGroup), 10000);
    }
    logInteraction({
      botId: ctx.botId, userId: ctx.userId, sessionId: ctx.sessionId,
      type: "message", direction: "outgoing",
      content: `remarketing:${ctx.step.title}`,
      metadata: {
        ...logMeta,
        mediaType: "VIDEO",
        title: ctx.step.title,
        mediaCount: ctx.step.mediaUrls.length
      },
      logPayloads: false
    });
    return;
  }

  const remarketingAudioFileId = ctx.step.type === "AUDIO" ? getAudioFileId(ctx.step, ctx.timeCompliments.timezone) : null;
  if (ctx.step.type === "AUDIO" && remarketingAudioFileId) {
    await withTimeout(ctx.telegram.sendVoice(ctx.chatId, remarketingAudioFileId, { caption: resolvedText, ...options }), 10000);
    logInteraction({
      botId: ctx.botId, userId: ctx.userId, sessionId: ctx.sessionId,
      type: "message", direction: "outgoing",
      content: `remarketing:${ctx.step.title}`,
      metadata: {
        ...logMeta,
        mediaType: "AUDIO",
        title: ctx.step.title
      },
      logPayloads: false
    });
    return;
  }

  if (ctx.step.type === "IMAGE" && ctx.step.mediaUrls.length > 0) {
    if (ctx.step.mediaUrls.length === 1) {
      const resolvedPhoto = await resolveMediaUrl(ctx.step.mediaUrls[0]);
      await withTimeout(ctx.telegram.sendPhoto(ctx.chatId, resolvedPhoto, { caption: resolvedText, ...options }), 10000);
    } else {
      const resolvedUrls = await Promise.all(ctx.step.mediaUrls.map(resolveMediaUrl));
      const mediaGroup: InputMediaPhoto[] = resolvedUrls.map((media, i) => ({
        type: "photo" as const,
        media,
        ...(i === 0 && resolvedText ? { caption: resolvedText } : {})
      }));
      await withTimeout((ctx.telegram as any).sendMediaGroup(ctx.chatId, mediaGroup), 10000);
    }
    logInteraction({
      botId: ctx.botId, userId: ctx.userId, sessionId: ctx.sessionId,
      type: "message", direction: "outgoing",
      content: `remarketing:${ctx.step.title}`,
      metadata: {
        ...logMeta,
        mediaType: "IMAGE",
        title: ctx.step.title,
        mediaCount: ctx.step.mediaUrls.length
      },
      logPayloads: false
    });
    return;
  }

  await withTimeout(ctx.telegram.sendMessage(ctx.chatId, resolvedText ?? " ", options), 10000);
  logInteraction({
    botId: ctx.botId, userId: ctx.userId, sessionId: ctx.sessionId,
    type: "message", direction: "outgoing",
    content: resolvedText ?? ctx.step.title,
    metadata: logMeta,
    logPayloads: false
  });
}
