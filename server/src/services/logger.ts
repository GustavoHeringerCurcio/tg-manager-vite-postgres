import { logger } from "../utils/logger.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
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

export function logInteraction(input: LogInteractionInput): void {
  let messageIdBigInt: bigint | undefined;
  let chatIdBigInt: bigint | undefined;
  try {
    messageIdBigInt = input.messageId != null ? BigInt(input.messageId) : undefined;
  } catch {
    logger.error(`[logger] Invalid messageId for BigInt conversion: ${String(input.messageId)}`);
  }
  try {
    chatIdBigInt = input.chatId != null ? BigInt(input.chatId) : undefined;
  } catch {
    logger.error(`[logger] Invalid chatId for BigInt conversion: ${String(input.chatId)}`);
  }
  void prisma.interaction.create({
    data: {
      botId: input.botId,
      userId: input.userId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      type: input.type,
      direction: input.direction,
      content: input.content,
      payload: input.logPayloads ? input.payload : undefined,
      stepIndex: input.stepIndex ?? undefined,
      buttonId: input.buttonId ?? undefined,
      messageId: messageIdBigInt,
      chatId: chatIdBigInt,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    }
  }).then(() => {
    interactionsLogged.inc({ bot_id: input.botId, direction: input.direction });
  }).catch((error: Error) => {
    interactionsFailed.inc({ bot_id: input.botId });
    logger.error(`[logger] Failed to write interaction: ${error.message}`);
  });
}
