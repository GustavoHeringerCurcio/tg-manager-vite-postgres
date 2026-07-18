import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export type LogInteractionInput = {
  botId: string;
  userId?: string | null;
  type: string;
  direction: "incoming" | "outgoing";
  content?: string | null;
  payload?: Prisma.InputJsonValue;
  logPayloads: boolean;
};

export function truncateContent(content?: string | null): string | null | undefined {
  return typeof content === "string" ? content.slice(0, 500) : content;
}

export function logInteraction(input: LogInteractionInput): void {
  void prisma.interaction.create({
    data: {
      botId: input.botId,
      userId: input.userId ?? undefined,
      type: input.type,
      direction: input.direction,
      content: truncateContent(input.content),
      payload: input.logPayloads ? input.payload : undefined
    }
  }).catch((error: Error) => {
    console.error(`[logger] Failed to write interaction: ${error.message}`);
  });
}
