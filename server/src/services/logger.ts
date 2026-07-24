import { logger } from "../utils/logger.js";
import type { Prisma } from "@prisma/client";
import { analyticsPrisma } from "./prisma.js";
import { interactionsLogged, interactionsFailed } from "../utils/metrics.js";

export type LogInteractionInput = {
  botId: string;
  userId?: string | null;
  sessionId?: string | null;
  type: string;
  direction: "incoming" | "outgoing";
  content?: string | null;
  payload?: Prisma.InputJsonValue;
  stepIndex?: number | null;
  buttonId?: string | null;
  messageId?: number | null;
  chatId?: number | null;
  metadata?: Prisma.InputJsonValue;
  logPayloads: boolean;
};

type InteractionRow = {
  botId: string;
  userId?: string;
  sessionId?: string;
  type: string;
  direction: string;
  content?: string;
  payload?: Prisma.InputJsonValue;
  stepIndex?: number;
  buttonId?: string;
  messageId?: bigint;
  chatId?: bigint;
  metadata?: Prisma.InputJsonValue;
};

const buffer: InteractionRow[] = [];
const FLUSH_SIZE = 100;
const FLUSH_INTERVAL_MS = 5000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void doFlush();
  }, FLUSH_INTERVAL_MS);
}

async function doFlush(): Promise<void> {
  if (flushing || buffer.length === 0) return;
  flushing = true;
  const batch = buffer.splice(0, buffer.length);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await analyticsPrisma.interaction.createMany({ data: batch as any });
    for (const row of batch) {
      interactionsLogged.inc({ bot_id: row.botId, direction: row.direction });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "batch flush failed";
    for (const row of batch) {
      interactionsFailed.inc({ bot_id: row.botId });
    }
    logger.error(`[logger] Batch flush failed (${batch.length} rows): ${message}`);
  } finally {
    flushing = false;
  }
}

async function flushAll(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (buffer.length > 0) {
    await doFlush();
  }
}

function toBigIntSafe(value: number | null | undefined): bigint | undefined {
  if (value == null) return undefined;
  try {
    return BigInt(value);
  } catch {
    logger.error(`[logger] Invalid BigInt conversion: ${String(value)}`);
    return undefined;
  }
}

export function logInteraction(input: LogInteractionInput): void {
  const row: InteractionRow = {
    botId: input.botId,
    userId: input.userId ?? undefined,
    sessionId: input.sessionId ?? undefined,
    type: input.type,
    direction: input.direction,
    content: input.content ?? undefined,
    payload: input.logPayloads ? input.payload : undefined,
    stepIndex: input.stepIndex ?? undefined,
    buttonId: input.buttonId ?? undefined,
    messageId: toBigIntSafe(input.messageId),
    chatId: toBigIntSafe(input.chatId),
    metadata: input.metadata as Prisma.InputJsonValue | undefined
  };

  buffer.push(row);

  if (buffer.length >= FLUSH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void doFlush();
  } else {
    scheduleFlush();
  }
}

export { flushAll };

export function truncateContent(content: string | null | undefined): string | null {
  if (!content) return content ?? null;
  return content.length > 500 ? content.slice(0, 500) : content;
}
