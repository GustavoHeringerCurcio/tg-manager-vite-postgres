import { PgBoss } from "pg-boss";
import { BotStatus } from "@prisma/client";
import type { RemarketingState } from "@prisma/client";
import { logger } from "../utils/logger.js";
import { prisma } from "./prisma.js";
import { getBotManager } from "./botRegistry.js";
import {
  remarketingJobsScheduled,
  remarketingJobsFailed,
  remarketingSent,
  remarketingSendFailed,
  remarketingOrphanedJobs,
  remarketingPastDue,
  remarketingDead,
  remarketingWorkerUp,
  remarketingErrors,
  remarketingActiveTotal
} from "../utils/metrics.js";
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
import { sendSystemAlert } from "./notifications.js";

const RETRY_LIMIT = 3;
const RETRY_DELAY_SECONDS = 60;
const BURST_CONCURRENCY = 30;
const NORMAL_CONCURRENCY = 5;

let boss: PgBoss | null = null;
let initialized = false;
let workerStarted = false;

async function ensureBossInitialized(): Promise<PgBoss> {
  if (!boss || !initialized) {
    await initRemarketingQueue();
    if (!boss) throw new Error("pg-boss failed to initialize — remarketing cannot be scheduled");
  }
  await boss.createQueue("remarketing").catch(() =>
    logger.warn("[remarketing-queue] createQueue failed")
  );
  if (!workerStarted) {
    await startRemarketingWorker().catch(() =>
      logger.warn("[remarketing-queue] ensureBossInitialized: worker start failed")
    );
  }
  return boss;
}

export function isWorkerRunning(): boolean {
  return workerStarted;
}

export async function initRemarketingQueue(): Promise<void> {
  if (initialized && boss) return;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  try {
    if (boss) {
      await boss.stop({ graceful: true, timeout: 10_000 }).catch((err) => {
        logger.warn(`[remarketing-queue] boss.stop failed on re-init: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  } catch (err) {
    logger.warn(`[remarketing-queue] cleanup error during re-init: ${err instanceof Error ? err.message : String(err)}`);
  }

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

  await boss.createQueue("remarketing");

  let useBurst = false;
  try {
    useBurst = await hasActiveBurst();
  } catch (err) {
    logger.warn(`[remarketing-queue] hasActiveBurst failed, falling back to normal concurrency: ${err instanceof Error ? err.message : String(err)}`);
  }

  const concurrency = useBurst ? BURST_CONCURRENCY : NORMAL_CONCURRENCY;
  logger.info(`[remarketing-queue] starting worker with concurrency=${concurrency} (burst=${useBurst})`);

  await boss.work("remarketing", { localConcurrency: concurrency }, async (jobs: { data: { stateId: string } }[]) => {
    for (const job of jobs) {
      await handleRemarketingJob(job.data.stateId);
    }
  });

  workerStarted = true;

  const metricsInterval = setInterval(refreshRemarketingMetrics, 60_000);
  metricsInterval.unref();

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
  const activeBoss = await ensureBossInitialized();

  const state = await prisma.remarketingState.findUnique({
    where: { userId_botId: { userId, botId } },
    select: { id: true }
  });
  if (!state) return;

  const nextSendAt = new Date(Date.now() + delayMs);
  const startAfter = Math.ceil(Math.max(delayMs, 0) / 1000);

  let jobId: string | null = null;
  let sendError: string | null = null;

  try {
    jobId = await activeBoss.send("remarketing", { stateId: state.id }, {
      startAfter,
      retryLimit: RETRY_LIMIT,
      retryDelay: RETRY_DELAY_SECONDS
    });
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
  }

  if (jobId) {
    await prisma.remarketingState.update({
      where: { id: state.id },
      data: { pgBossJobId: jobId, nextSendAt, retries: 0, lastError: null }
    });
    remarketingJobsScheduled.inc({ bot_id: botId });
    logger.info(`[remarketing:${botId}] scheduled job ${jobId} for user ${userId} in ${startAfter}s`);
  } else if (sendError) {
    remarketingJobsFailed.inc({ bot_id: botId, reason: "send_failed" });
    logger.warn(`[remarketing:${botId}] boss.send failed for user ${userId}: ${sendError}`);
    await prisma.remarketingState.update({
      where: { id: state.id },
      data: { lastError: sendError.length > 500 ? sendError.slice(0, 497) + "..." : sendError, retries: 0 }
    }).catch((err) => {
      logger.warn(`[remarketing:${botId}] failed to update state with error: ${err instanceof Error ? err.message : String(err)}`);
    });
  } else {
    logger.warn(`[remarketing:${botId}] boss.send returned null for user ${userId}`);
  }
}

export async function cancelRemarketingJob(userId: string, botId: string): Promise<void> {
  if (!boss) return;
  const state = await prisma.remarketingState.findUnique({
    where: { userId_botId: { userId, botId } },
    select: { pgBossJobId: true }
  });
  if (state?.pgBossJobId) {
    await boss.cancel("remarketing", state.pgBossJobId).catch((err) => {
      logger.warn(`[remarketing-queue] boss.cancel failed for job ${state.pgBossJobId}: ${err instanceof Error ? err.message : String(err)}`);
    });
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
    await boss.cancel("remarketing", jobIds).catch((err) => {
      logger.warn(`[remarketing-queue] boss.cancel batch failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}

export async function rescheduleAllRemarketingJobs(): Promise<void> {
  const activeBoss = await ensureBossInitialized().catch(() => null);
  if (!activeBoss) return;

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

      const jobId = await activeBoss.send("remarketing", { stateId: state.id }, {
        startAfter: Math.ceil(interval / 1000),
        retryLimit: RETRY_LIMIT,
        retryDelay: RETRY_DELAY_SECONDS
      }).catch((err) => {
        logger.warn(`[remarketing-queue] failed to reschedule past-due state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });

      if (jobId) {
        await prisma.remarketingState.update({
          where: { id: state.id },
          data: { pgBossJobId: jobId, nextSendAt, lastError: "past-due skipped on restart" }
        }).catch((err) => {
          logger.warn(`[remarketing-queue] failed to update past-due state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
        });
        skipped++;
      }
      continue;
    }

    const delayMs = state.nextSendAt!.getTime() - now.getTime();
    const jobId = await activeBoss.send("remarketing", { stateId: state.id }, {
      startAfter: Math.ceil(Math.max(delayMs, 0) / 1000),
      retryLimit: RETRY_LIMIT,
      retryDelay: RETRY_DELAY_SECONDS
    }).catch((err) => {
      logger.warn(`[remarketing-queue] failed to reschedule state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    });

    if (jobId) {
      await prisma.remarketingState.update({
        where: { id: state.id },
        data: { pgBossJobId: jobId }
      }).catch((err) => {
        logger.warn(`[remarketing-queue] failed to update rescheduled state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
      });
      scheduled++;
    }
  }

  if (scheduled > 0 || skipped > 0) {
    logger.info(`[remarketing-queue] rescheduled ${scheduled} pending jobs, skipped ${skipped} past-due`);
  }
}

export async function handleRemarketingJob(stateId: string): Promise<void> {
  const state = await prisma.remarketingState.findUnique({
    where: { id: stateId },
    include: { user: { select: { telegramId: true, firstName: true, isBlocked: true } } }
  });

  if (!state || !state.nextSendAt) return;

  if (state.user.isBlocked) {
    logger.info(`[remarketing:${state.botId}] user ${state.userId} is blocked, cancelling remarketing`);
    await prisma.remarketingState.delete({ where: { id: state.id } }).catch((err) => {
      logger.warn(`[remarketing:${state.botId}] failed to delete blocked-user state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
    });
    return;
  }

  const bot = await prisma.bot.findUnique({ where: { id: state.botId } });
  if (!bot) return;

  const config = normalizeRemarketing(bot.remarketing);
  if (!config.enabled || config.messages.length === 0) {
    await prisma.remarketingState.delete({ where: { id: state.id } }).catch((err) => {
      logger.warn(`[remarketing:${state.botId}] failed to delete disabled-config state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
    });
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
      }).catch((err) => {
        logger.warn(`[remarketing:${state.botId}] failed to update stale-skip state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
      });
      const activeBoss = await ensureBossInitialized().catch(() => null);
      if (activeBoss) {
        await activeBoss.send("remarketing", { stateId: state.id }, {
          startAfter: Math.ceil(activeInterval / 1000),
          retryLimit: RETRY_LIMIT,
          retryDelay: RETRY_DELAY_SECONDS
        });
      }
      return;
    }
  }

  const manager = getBotManager(state.botId);
  if (!manager) {
    remarketingJobsFailed.inc({ bot_id: state.botId, reason: "bot_manager_not_found" });
    return;
  }

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
      const activeBoss = await ensureBossInitialized().catch(() => null);
      if (activeBoss) {
        const delaySeconds = Math.ceil(Math.max(resumeAt - Date.now(), 0) / 1000);
        const jobId = await activeBoss.send("remarketing", { stateId: state.id }, {
          startAfter: delaySeconds,
          retryLimit: RETRY_LIMIT,
          retryDelay: RETRY_DELAY_SECONDS
        });
        await prisma.remarketingState.update({
          where: { id: state.id },
          data: { nextIndex: 0, nextSendAt, retries: 0, lastError: "burst non-cycling silence", pgBossJobId: jobId }
        }).catch((err) => {
          logger.warn(`[remarketing:${state.botId}] failed to update burst-silence state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
        });
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
    remarketingSent.inc({ bot_id: state.botId });
  } catch (error) {
    remarketingSendFailed.inc({ bot_id: state.botId });
    const message = error instanceof Error ? error.message : "remarketing send failed";
    logger.error(`[remarketing:${state.botId}] send failed: ${message}`);
    throw error;
  }

  await advanceState(state, config);
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

  const nextJobTime = Date.now() + activeInterval;
  const willStillBeBurst = state.burstUntil ? state.burstUntil.getTime() > nextJobTime : false;
  const burstEnded = wasBurst && !willStillBeBurst;
  const switchedMessageSets = burstEnded && config.useSeparateBurstMessages && config.burstMessages.length > 0;
  const nextIndex = switchedMessageSets ? 0 : newNextIndex;

  const now = Date.now();
  const nextSendAt = new Date(now + activeInterval);

  const activeBoss = await ensureBossInitialized().catch(() => null);
  if (!activeBoss) {
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
    return;
  }

  const jobId = await activeBoss.send("remarketing", { stateId: state.id }, {
    startAfter: Math.ceil(activeInterval / 1000),
    retryLimit: RETRY_LIMIT,
    retryDelay: RETRY_DELAY_SECONDS
  });

  if (jobId) {
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
  } else {
    logger.warn(`[remarketing-queue] advanceState: boss.send returned null for state ${state.id}`);
    await prisma.remarketingState.update({
      where: { id: state.id },
      data: {
        nextIndex,
        totalSent: newTotalSent,
        nextSendAt,
        retries: 0,
        lastError: null,
        pgBossJobId: null,
        ...(burstEnded ? { burstUntil: null } : {})
      }
    }).catch((err) => {
      logger.warn(`[remarketing-queue] failed to update advanced state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}

const ALERT_COOLDOWN_MS = 15 * 60_000;
const lastAlertAt = new Map<string, number>();

async function refreshRemarketingMetrics(): Promise<void> {
  remarketingWorkerUp.set(workerStarted ? 1 : 0);

  const bots = await prisma.bot.findMany({
    where: { status: BotStatus.ACTIVE, remarketingStates: { some: {} } },
    select: { id: true }
  }).catch(() => []);

  for (const bot of bots) {
    const botId = bot.id;

    const [orphaned, pastDue, dead, errors, active] = await Promise.all([
      prisma.remarketingState.count({
        where: { botId, pgBossJobId: null, nextSendAt: { not: null } }
      }),
      prisma.remarketingState.count({
        where: { botId, nextSendAt: { lt: new Date(), not: null } }
      }),
      prisma.remarketingState.count({
        where: { botId, nextSendAt: null }
      }),
      prisma.remarketingState.count({
        where: { botId, lastError: { not: null } }
      }),
      prisma.remarketingState.count({
        where: { botId, nextSendAt: { not: null } }
      }),
    ]).catch(() => [0, 0, 0, 0, 0]);

    remarketingOrphanedJobs.set({ bot_id: botId }, orphaned ?? 0);
    remarketingPastDue.set({ bot_id: botId }, pastDue ?? 0);
    remarketingDead.set({ bot_id: botId }, dead ?? 0);
    remarketingErrors.set({ bot_id: botId }, errors ?? 0);
    remarketingActiveTotal.set({ bot_id: botId }, active ?? 0);

    if ((orphaned ?? 0) > 0 || (dead ?? 0) > 0) {
      const now = Date.now();
      const lastAlert = lastAlertAt.get(botId) ?? 0;
      if (now - lastAlert > ALERT_COOLDOWN_MS) {
        lastAlertAt.set(botId, now);
        const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { name: true } }).catch(() => null);
        const botName = bot?.name ?? botId;
        const total = (orphaned ?? 0) + (dead ?? 0);
        sendSystemAlert(
          `Remarketing: ${total} stuck state(s) on ${botName}`,
          `${orphaned ?? 0} orphaned (no pg-boss job), ${dead ?? 0} dead (nextSendAt=null). Check admin panel > Remarketing > Diagnostics.`
        );
      }
    }
  }
}

export async function cleanStaleRemarketingJobs(): Promise<void> {
  try {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM pgboss.job WHERE name = 'remarketing' AND state IN ('completed', 'failed')`
    );
    if (result > 0) {
      logger.info(`[remarketing-queue] cleaned ${result} stale completed/failed jobs`);
    }
  } catch (err) {
    logger.warn(`[remarketing-queue] failed to clean stale jobs: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function recoverOrphanedRemarketingStates(): Promise<void> {
  const states = await prisma.remarketingState.findMany({
    where: {
      nextSendAt: null,
      bot: { status: BotStatus.ACTIVE }
    },
    select: { id: true, botId: true, userId: true }
  });

  let recovered = 0;
  for (const state of states) {
    try {
      const bot = await prisma.bot.findUnique({
        where: { id: state.botId },
        select: { remarketing: true }
      });
      if (!bot) continue;

      const config = normalizeRemarketing(bot.remarketing);
      if (!config.enabled) continue;

      const nextSendAt = new Date(Date.now() + config.intervalMs);
      await prisma.remarketingState.update({
        where: { id: state.id },
        data: { nextSendAt, lastError: "recovered orphaned state on startup" }
      });
      await scheduleRemarketingJob(state.userId, state.botId, config.intervalMs);
      recovered++;
    } catch (err) {
      logger.warn(`[remarketing-queue] failed to recover orphaned state ${state.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (recovered > 0) {
    logger.info(`[remarketing-queue] recovered ${recovered} orphaned remarketing states`);
  }
}

export type RemarketingQueueStats = {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
};

export async function getRemarketingQueueStats(): Promise<RemarketingQueueStats> {
  if (!boss) {
    return { pending: 0, active: 0, completed: 0, failed: 0, total: 0 };
  }
  try {
    const stats = await boss.getQueueStats("remarketing", { force: true });
    const latest = stats[stats.length - 1];
    if (!latest) {
      return { pending: 0, active: 0, completed: 0, failed: 0, total: 0 };
    }
    const pending = (latest.queuedCount ?? 0) + (latest.readyCount ?? 0);
    const active = latest.activeCount ?? 0;
    const failed = latest.failedCount ?? 0;
    const total = latest.totalCount ?? 0;
    const completed = Math.max(0, total - pending - active - failed);
    return { pending, active, completed, failed, total };
  } catch (error) {
    logger.warn("[remarketing-queue] failed to get queue stats");
    return { pending: 0, active: 0, completed: 0, failed: 0, total: 0 };
  }
}
