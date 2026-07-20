import type { Bot, RemarketingState } from "@prisma/client";
import { BotStatus } from "@prisma/client";
import type { Telegram } from "telegraf";
import type { InputMediaVideo, InlineKeyboardMarkup } from "telegraf/types";
import type { MessageStep } from "../bot/messageFlow.js";
import { normalizeRemarketing } from "../bot/remarketing.js";
import { resolveUserPlaceholders } from "../bot/placeholders.js";
import { getBotManager } from "./botRegistry.js";
import { logInteraction } from "./logger.js";
import { prisma } from "./prisma.js";

let pollerInterval: ReturnType<typeof setInterval> | null = null;

export function startRemarketingPoller(): void {
  if (pollerInterval) return;
  pollerInterval = setInterval(() => {
    void processRemarketingBatch();
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
  const config = normalizeRemarketing(botConfig.remarketing);
  if (!config.enabled || config.messages.length === 0) {
    await prisma.remarketingState.delete({ where: { id: state.id } }).catch(() => {});
    return;
  }

  const manager = getBotManager(state.botId);
  if (!manager) return;

  const index = state.nextIndex % config.messages.length;
  const step = config.messages[index];
  if (!step) return;

  const chatId = String(telegramId);
  await sendRemarketingStep(manager.telegram, chatId, step, state.botId, state.userId, state.user.firstName);

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
  firstName: string | null
): Promise<void> {
  const resolvedText = step.text ? resolveUserPlaceholders(step.text, { firstName }) : step.text;
  const replyMarkup = buildInlineKeyboard(step);
  const options = replyMarkup ? { reply_markup: replyMarkup as InlineKeyboardMarkup } : undefined;

  if (step.type === "VIDEO" && step.mediaUrls.length > 0) {
    if (step.mediaUrls.length === 1) {
      await telegram.sendVideo(chatId, step.mediaUrls[0], { caption: resolvedText, ...(options ?? {}) });
    } else {
      const mediaGroup: InputMediaVideo[] = step.mediaUrls.map((url, i) => ({
        type: "video" as const,
        media: url,
        ...(i === 0 && resolvedText ? { caption: resolvedText } : {})
      }));
      await (telegram as any).sendMediaGroup(chatId, mediaGroup);
    }
    logInteraction({ botId, userId, type: "message", direction: "outgoing", content: `remarketing:${step.title}`, logPayloads: false });
    return;
  }

  if (step.type === "AUDIO" && step.mediaUrls.length > 0) {
    await telegram.sendVoice(chatId, step.mediaUrls[0], { caption: resolvedText, ...(options ?? {}) });
    logInteraction({ botId, userId, type: "message", direction: "outgoing", content: `remarketing:${step.title}`, logPayloads: false });
    return;
  }

  await telegram.sendMessage(chatId, resolvedText ?? " ", options as any);
  logInteraction({ botId, userId, type: "message", direction: "outgoing", content: resolvedText ?? step.title, logPayloads: false });
}

function buildInlineKeyboard(step: MessageStep): { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> } | undefined {
  if (step.buttons.length === 0) return undefined;
  return {
    inline_keyboard: step.buttons.map((button) => [{
      text: button.label,
      ...(button.action === "OPEN_URL" ? { url: button.url } : { callback_data: `livepix_payment:${button.id}` })
    }])
  };
}
