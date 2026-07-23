import { PrismaClient, BotStatus, PaymentMethod } from "@prisma/client";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(rootDir, ".env.test") });
config({ path: resolve(rootDir, "server", ".env") });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const token = process.env.TEST_BOT_TOKEN;
  if (!token || token === "1234567890:AA...your_test_bot_token_here") {
    console.error("ERROR: Set TEST_BOT_TOKEN in your .env.test file first.");
    console.error("Create a test bot via @BotFather on Telegram and paste its token.");
    process.exit(1);
  }

  const botId = process.env.TEST_BOT_ID || "test-bot-load";
  const now = new Date();

  const existing = await prisma.bot.findUnique({ where: { id: botId } });

  if (existing) {
    console.log(`[setup-test-bot] Bot "${botId}" already exists, updating...`);
    await prisma.bot.update({
      where: { id: botId },
      data: {
        token,
        status: BotStatus.ACTIVE,
        messageFlow: buildMessageFlow(),
        remarketing: { enabled: false, messages: [], initialDelayMs: 30000, maxSends: 0, intervalMs: 60000, skipStaleMs: 0 },
        paymentFlow: buildPaymentFlow(),
        settings: { timezone: "America/Sao_Paulo", resetPixAfterStart: false, maxDailyPixGenerations: 50 },
        timeCompliments: {},
        updatedAt: now,
      },
    });
  } else {
    console.log(`[setup-test-bot] Creating bot "${botId}"...`);
    await prisma.bot.create({
      data: {
        id: botId,
        name: "Test Bot (Load Testing)",
        token,
        status: BotStatus.ACTIVE,
        messageFlow: buildMessageFlow(),
        remarketing: { enabled: false, messages: [], initialDelayMs: 30000, maxSends: 0, intervalMs: 60000, skipStaleMs: 0 },
        paymentFlow: buildPaymentFlow(),
        settings: { timezone: "America/Sao_Paulo", resetPixAfterStart: false, maxDailyPixGenerations: 50 },
        timeCompliments: {},
      },
    });
  }

  await prisma.user.deleteMany({ where: { botId } });
  await prisma.transaction.deleteMany({ where: { botId } });
  await prisma.interaction.deleteMany({ where: { botId } });
  await prisma.userSession.deleteMany({ where: { botId } });
  await prisma.remarketingState.deleteMany({ where: { botId } });
  await prisma.pixelEvent.deleteMany({ where: { botId } });

  console.log(`[setup-test-bot] Bot "${botId}" ready for load testing.`);
  console.log(`[setup-test-bot] Cleared all test data for this bot.`);
  console.log(`[setup-test-bot] Bot ID for k6: ${botId}`);

  await prisma.$disconnect();
}

function buildMessageFlow(): unknown[] {
  return [
    {
      id: "welcome",
      title: "Welcome",
      type: "TEXT",
      text: "Welcome to the test bot! Click below to test a payment.",
      delayMs: 0,
      buttons: [
        {
          id: "pay_basic",
          label: "Buy Basic - R$ 9.90",
          color: "GREEN",
          action: "LIVEPIX_PAYMENT",
          price: 9.9,
        },
        {
          id: "pay_pro",
          label: "Buy Pro - R$ 29.90",
          color: "BLUE",
          action: "LIVEPIX_PAYMENT",
          price: 29.9,
        },
        {
          id: "info",
          label: "Info",
          color: "BLUE",
          action: "OPEN_URL",
          url: "https://example.com",
        },
      ],
    },
  ];
}

function buildPaymentFlow(): unknown {
  return {
    steps: [
      {
        id: "payment_details",
        title: "Payment",
        type: "TEXT",
        text: "Payment amount: R$ {amount}\n\nPIX Code:\n{pix_code}",
        delayMs: 500,
        mediaUrls: [],
        buttons: [],
        includePixCode: true,
      },
    ],
    verifyPaymentSuccessFlow: [
      {
        id: "success",
        title: "Success",
        type: "TEXT",
        text: "Payment confirmed! Thank you for your purchase.",
        delayMs: 0,
        mediaUrls: [],
        buttons: [],
      },
    ],
    verifyPaymentFailFlow: [
      {
        id: "pending",
        title: "Pending",
        type: "TEXT",
        text: "Payment not yet confirmed. Please pay the PIX and try again.",
        delayMs: 0,
        mediaUrls: [],
        buttons: [],
      },
    ],
    deliverables: [
      {
        id: "product",
        title: "Product",
        type: "TEXT",
        text: "Here is your product: https://example.com/download",
        delayMs: 0,
        mediaUrls: [],
        buttons: [],
      },
    ],
    verifyLabel: "Verify Payment",
    pixCopyLabel: "Copy PIX",
  };
}

main().catch((error) => {
  console.error("[setup-test-bot] Fatal error:", error);
  process.exit(1);
});
