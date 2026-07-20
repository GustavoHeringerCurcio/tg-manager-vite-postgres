import type { Transaction, User } from "@prisma/client";
import { getBotManager } from "./botRegistry.js";
import { logInteraction } from "./logger.js";

const POLL_INTERVAL_MS = 30_000;
const POLL_WINDOW_MINUTES = Number(process.env.PAYMENT_POLL_WINDOW_MINUTES ?? "30");
const BATCH_SIZE = 50;

let pollerInterval: ReturnType<typeof setInterval> | null = null;

export function startPaymentPoller(): void {
  if (pollerInterval) return;
  pollerInterval = setInterval(() => {
    void processPendingPayments();
  }, POLL_INTERVAL_MS);
}

export function stopPaymentPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}

type PendingTransaction = Transaction & { user: User };

async function processPendingPayments(): Promise<void> {
  const { prisma } = await import("./prisma.js");
  try {
    const since = new Date(Date.now() - POLL_WINDOW_MINUTES * 60_000);
    const pending = await prisma.transaction.findMany({
      where: {
        status: "PENDING",
        livepixReference: { not: null },
        createdAt: { gte: since }
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE
    });

    for (const txn of pending) {
      try {
        await verifyOne(txn);
      } catch (error) {
        const message = error instanceof Error ? error.message : "payment poller verify failed";
        console.error(`[payment-poller:${txn.botId}] ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment poller batch failed";
    console.error(`[payment-poller] ${message}`);
  }
}

async function verifyOne(txn: PendingTransaction): Promise<void> {
  const { prisma } = await import("./prisma.js");
  const manager = getBotManager(txn.botId);
  if (!manager) return;

  const payment = await manager.livepix.checkPayment(txn.livepixReference!);
  if (!payment || !payment.amount || payment.amount <= 0) return;

  await prisma.transaction.update({
    where: { id: txn.id },
    data: { status: "COMPLETED" }
  });

  const amountBrl = (payment.amount / 100).toFixed(2);
  const chatId = String(txn.user.telegramId);

  try {
    await manager.telegram.sendMessage(
      chatId,
      `✅ Pagamento confirmado!\n\nValor: R$ ${amountBrl}\n\nObrigado pela sua compra!`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "send confirmation failed";
    console.error(`[payment-poller:${txn.botId}] ${message}`);
  }

  logInteraction({
    botId: txn.botId,
    userId: txn.userId,
    type: "message",
    direction: "outgoing",
    content: "Payment auto-confirmed",
    logPayloads: false
  });
}
