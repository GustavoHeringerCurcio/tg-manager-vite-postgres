import { PgBoss } from "pg-boss";
import { BotStatus } from "@prisma/client";
import type { RemarketingState } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { prisma } from "./prisma.js";
import { getBotManager } from "./botRegistry.js";
import { normalizeRemarketing, getDiscountPercentage, normalizeTimeCompliments } from "../bot/remarketing.js";
import { normalizeBotSettings } from "../bot/botSettings.js";
import type { RemarketingConfig } from "../bot/remarketing.js";
import { sendRemarketingStep } from "./remarketingSender.js";

const RETRY_LIMIT = 3;
const RETRY_DELAY_SECONDS = 60;
const CONCURRENCY = 5;

let boss: PgBoss | null = null;
let initialized = false;
let workerStarted = false;

export function isWorkerRunning(): boolean {
  return workerStarted;
}

export async function initRemarketingQueue(): Promise<void> {
  if (initialized) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  boss = new PgBoss(dbUrl);

  boss.on("error", (error: Error) => {
    logger.error(`[remarketing-queue] pg-boss error: ${error.message}`);
  });

  await boss.start();

  initialized = true;
  logger.info("[remarketing-queue] initialized");
}

export async function startRemarketingWorker(): Promise<void> {
  if (workerStarted) return;
  if (!boss) throw new Error("remarketing queue not initialized — call initRemarketingQueue first");

  await boss.work("remarketing", { localConcurrency: CONCURRENCY }, async (jobs: { data: { stateId: string } }[]) => {
    for (const job of jobs) {
      await handleRemarketingJob(job.data.stateId);
    }
  });

  workerStarted = true;
  logger.info("[remarketing-queue] worker started");
}

export async function stopRemarketingWorker(): Promise<void> {
  if (!boss) return;
  workerStarted = false;
  try {
    await boss.stop({ graceful: true, timeout: 30_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    logger.error(`[remarketing-queue] stop error: ${message}`);
  }
  boss = null;
  initialized = false;
  logger.info("[remarketing-queue] worker stopped");
}

export async function scheduleRemarketingJob(userId: string, botId: string, delayMs: number): Promise<void> {
  if (!boss) return;
  const state = await prisma.remarketingState.findUnique({
    where: { userId_botId: { userId, botId } },
    select: { id: true }
  });
  if (!state) return;

  const nextSendAt = new Date(Date.now() + delayMs);
  const jobId = await boss.send("remarketing", { stateId: state.id }, {
    startAfter: Math.ceil(Math.max(delayMs, 0) / 1000),
    retryLimit: RETRY_LIMIT,
    retryDelay: RETRY_DELAY_SECONDS,
    singletonKey: `remarketing-${state.id}`
  });

  await prisma.remarketingState.update({
    where: { id: state.id },
    data: { pgBossJobId: jobId, nextSendAt }
  }).catch(() => {});
}

export async function cancelRemarketingJob(userId: string, botId: string): Promise<void> {
  if (!boss) return;
  const state = await prisma.remarketingState.findUnique({
    where: { userId_botId: { userId, botId } },
    select: { pgBossJobId: true }
  });
  if (state?.pgBossJobId) {
    await boss.cancel("remarketing", state.pgBossJobId).catch(() => {});
  }
}

export async function cancelAllRemarketingJobsForBot(botId: string): Promise<void> {
  if (!boss) return;
  const states = await prisma.remarketingState.findMany({
    where: { botId, pgBossJobId: { not: null } },
    select: { pgBossJobId: true }
  });
  const jobIds = states.map(s => s.pgBossJobId!).filter(Boolean);
  if (jobIds.length > 0) {
    await boss.cancel("remarketing", jobIds).catch(() => {});
  }
}

export async function rescheduleAllRemarketingJobs(): Promise<void> {
  if (!boss) return;

  const now = new Date();
  const states = await prisma.remarketingState.findMany({
    where: {
      nextSendAt: { not: null, gt: now },
      bot: { status: BotStatus.ACTIVE }
    },
    select: { id: true, nextSendAt: true }
  });

  let scheduled = 0;
  for (const state of states) {
    const delayMs = state.nextSendAt!.getTime() - now.getTime();
    const jobId = await boss.send("remarketing", { stateId: state.id }, {
      startAfter: Math.ceil(Math.max(delayMs, 0) / 1000),
      retryLimit: RETRY_LIMIT,
      retryDelay: RETRY_DELAY_SECONDS,
      singletonKey: `remarketing-${state.id}`
    }).catch(() => null);

    if (jobId) {
      await prisma.remarketingState.update({
        where: { id: state.id },
        data: { pgBossJobId: jobId }
      }).catch(() => {});
      scheduled++;
    }
  }

  if (scheduled > 0) {
    logger.info(`[remarketing-queue] rescheduled ${scheduled} pending jobs`);
  }
}

async function handleRemarketingJob(stateId: string): Promise<void> {
  const state = await prisma.remarketingState.findUnique({
    where: { id: stateId },
    include: { user: { select: { telegramId: true, firstName: true } } }
  });

  if (!state || !state.nextSendAt) return;

  const bot = await prisma.bot.findUnique({ where: { id: state.botId } });
  if (!bot) return;

  const config = normalizeRemarketing(bot.remarketing);
  if (!config.enabled || config.messages.length === 0) {
    await prisma.remarketingState.delete({ where: { id: state.id } }).catch(() => {});
    return;
  }

  const now = Date.now();

  if (config.skipStale) {
    const staleThreshold = config.intervalMs * 2;
    if (now - state.nextSendAt.getTime() > staleThreshold) {
      logger.warn(`[remarketing:${state.botId}] skipped stale message (nextSendAt was ${state.nextSendAt.toISOString()}), advancing to next interval`);
      await advanceState(state, config);
      return;
    }
  }

  const manager = getBotManager(state.botId);
  if (!manager) return;

  const botSettings = normalizeBotSettings(bot.settings);
  const timeCompliments = normalizeTimeCompliments(bot.timeCompliments, botSettings.timezone);

  const index = state.nextIndex % config.messages.length;
  const step = config.messages[index];
  if (!step) return;

  const discountPercentage = getDiscountPercentage(config.discountOffer, state.totalSent);
  const applyDiscount = discountPercentage > 0;

  const session = await prisma.userSession.findFirst({
    where: { botId: state.botId, userId: state.userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true }
  });

  try {
    await sendRemarketingStep({
      telegram: manager.telegram,
      chatId: String(state.user.telegramId),
      step,
      botId: state.botId,
      userId: state.userId,
      sessionId: session?.id ?? null,
      firstName: state.user.firstName,
      timeCompliments,
      applyDiscount,
      discountPercentage,
      labelTemplate: config.discountOffer.labelTemplate,
      showOriginalPrice: config.discountOffer.showOriginalPrice
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "remarketing send failed";
    logger.error(`[remarketing:${state.botId}] ${message}`);
    await prisma.remarketingState.update({
      where: { id: state.id },
      data: { retries: state.retries + 1, lastError: message }
    }).catch(() => {});
    throw error;
  }

  await advanceState(state, config);
}

async function advanceState(state: RemarketingState, config: RemarketingConfig): Promise<void> {
  const newTotalSent = state.totalSent + 1;
  const newNextIndex = (state.nextIndex + 1) % config.messages.length;

  if (config.maxSends > 0 && newTotalSent >= config.maxSends) {
    await prisma.remarketingState.delete({ where: { id: state.id } });
    return;
  }

  const nextSendAt = new Date(Date.now() + config.intervalMs);

  if (boss) {
    const jobId = await boss.send("remarketing", { stateId: state.id }, {
      startAfter: Math.ceil(config.intervalMs / 1000),
      retryLimit: RETRY_LIMIT,
      retryDelay: RETRY_DELAY_SECONDS,
      singletonKey: `remarketing-${state.id}`
    }).catch(() => null);

    await prisma.remarketingState.update({
      where: { id: state.id },
      data: {
        nextIndex: newNextIndex,
        totalSent: newTotalSent,
        nextSendAt,
        retries: 0,
        lastError: null,
        pgBossJobId: jobId
      }
    });

    return;
  }

  await prisma.remarketingState.update({
    where: { id: state.id },
    data: {
      nextIndex: newNextIndex,
      totalSent: newTotalSent,
      nextSendAt,
      retries: 0,
      lastError: null
    }
  });
}
