import { logger } from "../utils/logger.js";
import type { Transaction, User } from "@prisma/client";
import { getBotManager } from "./botRegistry.js";
import { logInteraction } from "./logger.js";
import { paymentsConfirmed } from "../utils/metrics.js";
import { getGlobalConfig } from "../bot/globalConfig.js";
import { notifyPurchaseConfirmed } from "./notifications.js";
import { sendPixelEvent } from "./facebookPixel.js";
import { sendUtmifyOrder } from "./utmify.js";

const POLL_INTERVAL_MS = 30_000;
const BATCH_SIZE = 50;

let pollerTimeout: ReturnType<typeof setTimeout> | null = null;
let running = false;

function scheduleNext(): void {
  if (running) return;
  pollerTimeout = setTimeout(() => {
    pollerTimeout = null;
    void processPendingPayments();
  }, POLL_INTERVAL_MS);
}

export function startPaymentPoller(): void {
  if (pollerTimeout || running) return;
  scheduleNext();
}

export function stopPaymentPoller(): void {
  running = false;
  if (pollerTimeout) {
    clearTimeout(pollerTimeout);
    pollerTimeout = null;
  }
}

type PendingTransaction = Transaction & { user: User };

async function processPendingPayments(): Promise<void> {
  running = true;
  const { prisma } = await import("./prisma.js");
  try {
    const since = new Date(Date.now() - getGlobalConfig().paymentPollWindowMinutes * 60_000);
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
        logger.error(`[payment-poller:${txn.botId}] ${message}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "payment poller batch failed";
    logger.error(`[payment-poller] ${message}`);
  } finally {
    running = false;
    if (!pollerTimeout) {
      scheduleNext();
    }
  }
}

async function verifyOne(txn: PendingTransaction): Promise<void> {
  const { prisma } = await import("./prisma.js");
  const manager = getBotManager(txn.botId);
  if (!manager) return;

  let payment: Awaited<ReturnType<typeof manager.livepix.checkPayment>> | null = null;
  try {
    payment = await manager.livepix.checkPayment(txn.livepixReference!);
  } catch (error) {
    const message = error instanceof Error ? error.message : "check payment failed";
    logger.error(`[payment-poller:${txn.botId}] ${message}`);
    return;
  }
  if (!payment || !payment.amount || payment.amount <= 0) return;

  await prisma.transaction.update({
    where: { id: txn.id },
    data: { status: "COMPLETED" }
  });

  paymentsConfirmed.inc({ bot_id: txn.botId, source: "poller" });

  const amountBrl = (payment.amount / 100).toFixed(2);
  const displayName = txn.user.firstName || txn.user.username || undefined;

  notifyPurchaseConfirmed(txn.botId, parseFloat(amountBrl), displayName);

  const chatId = String(txn.user.telegramId);

  try {
    const sendPromise = manager.telegram.sendMessage(
      chatId,
      `✅ Pagamento confirmado!\n\nValor: R$ ${amountBrl}\n\nObrigado pela sua compra!`,
      { parse_mode: "HTML" }
    );
    await Promise.race([
      sendPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("telegram send timeout")), 10000))
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "send confirmation failed";
    logger.error(`[payment-poller:${txn.botId}] ${message}`);
  }

  logInteraction({
    botId: txn.botId,
    userId: txn.userId,
    type: "message",
    direction: "outgoing",
    content: "Payment auto-confirmed",
    logPayloads: false
  });

  try {
    const { cancelRemarketingForUser } = await import("../bot/handlers.js");
    await cancelRemarketingForUser(txn.botId, txn.userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[payment-poller:${txn.botId}] remarketing cancel failed: ${msg}`);
  }

  try {
    const bot = await prisma.bot.findUnique({
      where: { id: txn.botId },
      select: {
        fbPixelId: true, fbAccessToken: true, fbEnabled: true, name: true,
        utmifyApiToken: true, utmifyEnabled: true
      }
    });
    if (bot) {
      sendPixelEvent(
        txn.botId,
        txn.userId,
        txn.user.telegramId,
        bot.name,
        bot.fbPixelId,
        bot.fbAccessToken,
        bot.fbEnabled,
        {
          eventName: "Purchase",
          eventTime: Math.floor(Date.now() / 1000),
          userData: { externalId: txn.user.telegramId.toString() },
          customData: { currency: "BRL", value: payment.amount / 100, transaction_id: txn.livepixReference },
          eventSourceUrl: bot.name ? `https://t.me/${bot.name}` : ""
        }
      );

      if (bot.utmifyApiToken && bot.utmifyEnabled) {
        const session = await prisma.userSession.findFirst({
          where: { botId: txn.botId, userId: txn.userId },
          orderBy: { startedAt: "desc" },
          select: { metadata: true }
        });
        const meta = session?.metadata as Record<string, unknown> | undefined;
        const utmParams = (meta?.utmParams as Record<string, string>) ?? null;

        const name = txn.user.firstName || txn.user.username || "User";
        sendUtmifyOrder({
          botId: txn.botId,
          orderId: txn.id,
          status: "paid",
          customerName: name,
          customerEmail: `${name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}.${txn.user.telegramId}@botflix.user`,
          productName: "Produto",
          priceInCents: Math.round(txn.amount * 100),
          utmParams,
          totalPaidCents: Math.round(txn.amount * 100),
          createdAt: txn.createdAt,
          apiToken: bot.utmifyApiToken,
          enabled: bot.utmifyEnabled
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[payment-poller:${txn.botId}] pixel Purchase event failed: ${msg}`);
  }
}
