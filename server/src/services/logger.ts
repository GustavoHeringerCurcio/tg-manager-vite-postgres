import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

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
      messageId: input.messageId != null ? BigInt(input.messageId) : undefined,
      chatId: input.chatId != null ? BigInt(input.chatId) : undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    }
  }).catch((error: Error) => {
    console.error(`[logger] Failed to write interaction: ${error.message}`);
  });
}
