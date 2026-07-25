import { PgBoss } from "pg-boss";
import { BotStatus } from "@prisma/client";
import type { RemarketingState } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { prisma } from "./prisma.js";
import { getBotManager } from "./botRegistry.js";
import {
  normalizeRemarketing,
  getDiscountPercentage,
  normalizeTimeCompliments,
  isBurstActive,
  getActiveInterval,
  getActiveMessages
} from "../bot/remarketing.js";
import { normalizeBotSettings } from "../bot/botSettings.js";
import type { RemarketingConfig } from "../bot/remarketing.js";
import { sendRemarketingStep } from "./remarketingSender.js";

const RETRY_LIMIT = 3;
const RETRY_DELAY_SECONDS = 60;
const BURST_CONCURRENCY = 30;
const NORMAL_CONCURRENCY = 5;

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

  boss = new PgBoss({ connectionString: dbUrl });

  boss.on("error", (error: Error) => {
    logger.error(`[remarketing-queue] pg-boss error: ${error.message}`);
  });

  await boss.start();

  initialized = true;
  logger.info("[remarketing-queue] initialized");
}

async function hasActiveBurst(): Promise<boolean> {
  try {
    const bots = await prisma.bot.findMany({
      where: { status: BotStatus.ACTIVE },
      select: { remarketing: true }
    });
    for (const bot of bots) {
      const config = normalizeRemarketing(bot.remarketing);
      if (config.enabled && config.burstIntervalMs > 0) {
        return true;
      }
    }
  } catch {
    // fallback to normal concurrency on error
  }
  return false;
}

export async function startRemarketingWorker(): Promise<void> {
  if (workerStarted) return;
  if (!boss) throw new Error("remarketing queue not initialized — call initRemarketingQueue first");

  const useBurst = await hasActiveBurst();
  const concurrency = useBurst ? BURST_CONCURRENCY : NORMAL_CONCURRENCY;
  logger.info(`[remarketing-queue] starting worker with concurrency=${concurrency} (burst=${useBurst})`);

  await boss.work("remarketing", { localConcurrency: concurrency }, async (jobs: { data: { stateId: string } }[]) => {
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
  if (!boss) {
    logger.warn("[remarketing-queue] scheduleRemarketingJob called but pg-boss is not initialized — remarketing will not run");
    return;
  }
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
      nextSendAt: { not: null },
      bot: { status: BotStatus.ACTIVE }
    },
    select: { id: true, nextSendAt: true, burstUntil: true, botId: true }
  });

  let scheduled = 0;
  let skipped = 0;

  for (const state of states) {
    const isPastDue = state.nextSendAt!.getTime() <= now.getTime();

    if (isPastDue) {
      const bot = await prisma.bot.findUnique({
        where: { id: state.botId },
        select: { remarketing: true }
      }).catch(() => null);
      if (!bot) continue;

      const config = normalizeRemarketing(bot.remarketing);
      const interval = getActiveInterval(state, config);
      const nextSendAt = new Date(Date.now() + interval);

      const jobId = await boss.send("remarketing", { stateId: state.id }, {
        startAfter: Math.ceil(interval / 1000),
        retryLimit: RETRY_LIMIT,
        retryDelay: RETRY_DELAY_SECONDS,
        singletonKey: `remarketing-${state.id}`
      }).catch(() => null);

      if (jobId) {
        await prisma.remarketingState.update({
          where: { id: state.id },
          data: { pgBossJobId: jobId, nextSendAt, lastError: "past-due skipped on restart" }
        }).catch(() => {});
        skipped++;
      }
      continue;
    }

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

  if (scheduled > 0 || skipped > 0) {
    logger.info(`[remarketing-queue] rescheduled ${scheduled} pending jobs, skipped ${skipped} past-due`);
  }
}

async function handleRemarketingJob(stateId: string): Promise<void> {
  const state = await prisma.remarketingState.findUnique({
    where: { id: stateId },
    include: { user: { select: { telegramId: true, firstName: true, isBlocked: true } } }
  });

  if (!state || !state.nextSendAt) return;

  if (state.user.isBlocked) {
    logger.info(`[remarketing:${state.botId}] user ${state.userId} is blocked, cancelling remarketing`);
    await prisma.remarketingState.delete({ where: { id: state.id } }).catch(() => {});
    return;
  }

  const bot = await prisma.bot.findUnique({ where: { id: state.botId } });
  if (!bot) return;

  const config = normalizeRemarketing(bot.remarketing);
  if (!config.enabled || config.messages.length === 0) {
    await prisma.remarketingState.delete({ where: { id: state.id } }).catch(() => {});
    return;
  }

  const now = Date.now();

  if (config.skipStale) {
    const activeInterval = getActiveInterval(state, config);
    const staleThreshold = activeInterval * 2;
    if (now - state.nextSendAt.getTime() > staleThreshold) {
      logger.warn(`[remarketing:${state.botId}] skipped stale message (nextSendAt was ${state.nextSendAt.toISOString()}), rescheduling next without counting send`);
      const activeMessages = getActiveMessages(state, config);
      const newNextIndex = (state.nextIndex + 1) % activeMessages.length;
      const nextSendAt = new Date(Date.now() + activeInterval);
      await prisma.remarketingState.update({
        where: { id: state.id },
        data: { nextIndex: newNextIndex, nextSendAt, retries: 0, lastError: "skipped stale" }
      }).catch(() => {});
      if (boss) {
        await boss.send("remarketing", { stateId: state.id }, {
          startAfter: Math.ceil(activeInterval / 1000),
          retryLimit: RETRY_LIMIT,
          retryDelay: RETRY_DELAY_SECONDS,
          singletonKey: `remarketing-${state.id}`
        }).catch(() => null);
      }
      return;
    }
  }

  const manager = getBotManager(state.botId);
  if (!manager) return;

  const botSettings = normalizeBotSettings(bot.settings);
  const timeCompliments = normalizeTimeCompliments(bot.timeCompliments, botSettings.timezone);

  const activeMessages = getActiveMessages(state, config);
  const index = state.nextIndex % activeMessages.length;
  const step = activeMessages[index];
  if (!step) return;

  const wasBurst = isBurstActive(state, config);
  const shouldCycle = wasBurst ? config.burstCycleMessages : true;

  if (wasBurst && !shouldCycle) {
    const newNextIndex = (state.nextIndex + 1) % activeMessages.length;
    if (newNextIndex === 0 && state.nextIndex !== 0) {
      logger.info(`[remarketing:${state.botId}] burst non-cycling completed, silencing until burst ends for user ${state.userId}`);
      const resumeAt = state.burstUntil
        ? state.burstUntil.getTime() + config.initialDelayMs
        : Date.now() + config.intervalMs;
      const nextSendAt = new Date(resumeAt);
      if (boss) {
        const delaySeconds = Math.ceil(Math.max(resumeAt - Date.now(), 0) / 1000);
        const jobId = await boss.send("remarketing", { stateId: state.id }, {
          startAfter: delaySeconds,
          retryLimit: RETRY_LIMIT,
          retryDelay: RETRY_DELAY_SECONDS,
          singletonKey: `remarketing-${state.id}`
        }).catch(() => null);
        await prisma.remarketingState.update({
          where: { id: state.id },
          data: { nextIndex: 0, nextSendAt, retries: 0, lastError: "burst non-cycling silence", pgBossJobId: jobId }
        }).catch(() => {});
      }
      return;
    }
  }

  const discountPercentage = getDiscountPercentage(config.discountOffer, state.totalSent);
  const applyDiscount = discountPercentage > 0;

  const session = await prisma.userSession.findFirst({
    where: { botId: state.botId, userId: state.userId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true }
  });

  await advanceState(state, config);

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
    logger.error(`[remarketing:${state.botId}] send failed after advance: ${message}`);
  }
}

async function advanceState(state: RemarketingState, config: RemarketingConfig): Promise<void> {
  const wasBurst = isBurstActive(state, config);
  const activeMessages = getActiveMessages(state, config);
  const activeInterval = getActiveInterval(state, config);

  const newTotalSent = state.totalSent + 1;
  const newNextIndex = (state.nextIndex + 1) % activeMessages.length;

  if (config.maxSends > 0 && newTotalSent >= config.maxSends) {
    await prisma.remarketingState.delete({ where: { id: state.id } });
    return;
  }

  const isNowBurst = isBurstActive({ ...state, burstUntil: state.burstUntil }, config);
  const burstEnded = wasBurst && !isNowBurst;
  const nextIndex = burstEnded ? 0 : newNextIndex;

  const now = Date.now();
  const nextSendAt = new Date(now + activeInterval);

  if (boss) {
    const jobId = await boss.send("remarketing", { stateId: state.id }, {
      startAfter: Math.ceil(activeInterval / 1000),
      retryLimit: RETRY_LIMIT,
      retryDelay: RETRY_DELAY_SECONDS,
      singletonKey: `remarketing-${state.id}`
    }).catch(() => null);

    await prisma.remarketingState.update({
      where: { id: state.id },
      data: {
        nextIndex,
        totalSent: newTotalSent,
        nextSendAt,
        retries: 0,
        lastError: null,
        pgBossJobId: jobId,
        ...(burstEnded ? { burstUntil: null } : {})
      }
    });

    return;
  }

  logger.warn(`[remarketing-queue] advanceState called but pg-boss is down — state ${state.id} left inactive`);
  await prisma.remarketingState.update({
    where: { id: state.id },
    data: {
      nextIndex,
      totalSent: newTotalSent,
      nextSendAt: null,
      retries: 0,
      lastError: "pg-boss unavailable — re-trigger via /start or admin API"
    }
  });
}
