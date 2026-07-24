import "dotenv/config";
import compression from "compression";
import cluster from "node:cluster";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { adminAuth } from "./middleware/auth.js";
import { webhookDispatcher } from "./middleware/webhook.js";
import { apiRouter } from "./routes/api.js";
import { chatRouter } from "./routes/chat.js";
import { facebookPixelRouter } from "./routes/facebookPixel.js";
import { botSettingsRouter } from "./routes/botSettings.js";
import { loadEnv } from "./utils/env.js";
import { HttpError } from "./utils/errors.js";
import { logger } from "./utils/logger.js";
import { metricsResponse } from "./utils/metrics.js";
import { prisma } from "./services/prisma.js";
import { loadActiveBots, shutdownAllBots } from "./services/botLifecycle.js";
import { startRemarketingPoller, stopRemarketingPoller } from "./services/remarketingScheduler.js";
import { startPaymentPoller, stopPaymentPoller } from "./services/paymentPoller.js";
import { normalizePaymentFlow } from "./bot/paymentFlow.js";
import type { MessageButton } from "./bot/messageFlow.js";
import { utilsRouter } from "./routes/utils.js";

(BigInt.prototype as any).toJSON = function() { return this.toString(); };

const env = loadEnv();
const effectiveWorkers = env.workerCount === 0 ? availableParallelism() : env.workerCount;

let app: ReturnType<typeof express>;

if (effectiveWorkers > 1 && cluster.isPrimary) {
  logger.info(`[cluster] Primary ${process.pid} forking ${effectiveWorkers} workers`);

  for (let i = 0; i < effectiveWorkers; i++) {
    cluster.fork({ WORKER_ID: String(i) });
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`[cluster] Worker ${worker.process.pid} died (${signal ?? code}), restarting`);
    cluster.fork();
  });

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      for (const id in cluster.workers) {
        cluster.workers[id]?.kill(sig);
      }
    });
  }

  app = undefined as unknown as ReturnType<typeof express>;
  // Primary process stays alive to supervise workers — do not start Express.
} else {
  const workerId = process.env.WORKER_ID ? Number(process.env.WORKER_ID) : 0;
  const isPrimaryWorker = workerId === 0;
  const label = effectiveWorkers > 1 ? `worker:${workerId}` : "server";
  app = express();
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(dirname, "../public");

app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.post("/webhook/:botId", webhookDispatcher);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, uptime: process.uptime(), database: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "healthcheck failed";
    res.status(500).json({ error: message, ok: false });
  }
});

app.get("/metrics", async (_req, res) => {
  try {
    res.set("Content-Type", "text/plain");
    res.end(await metricsResponse());
  } catch (error) {
    res.status(500).end();
  }
});

app.use("/api", adminAuth(env.adminPassword), apiRouter(env));
app.use("/api", adminAuth(env.adminPassword), chatRouter());
app.use("/api", adminAuth(env.adminPassword), facebookPixelRouter());
app.use("/api", adminAuth(env.adminPassword), botSettingsRouter(env));
app.use("/api", adminAuth(env.adminPassword), utilsRouter());

app.post("/api/bots/:botId/payment/simulate-confirm", adminAuth(env.adminPassword), async (req: Request, res: Response) => {
  try {
    const botId = String(req.params.botId ?? "");
    const reference = typeof req.body?.reference === "string" ? req.body.reference.trim() : "";

    if (!botId || !reference) {
      res.status(400).json({ error: "botId and reference are required" });
      return;
    }

    const transaction = await prisma.transaction.findFirst({
      where: { botId, livepixReference: reference, status: "PENDING" },
      select: { id: true, userId: true }
    });

    if (!transaction) {
      res.status(404).json({ error: "Pending transaction not found for this reference" });
      return;
    }

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: "COMPLETED" }
    });

    const [bot, user] = await Promise.all([
      prisma.bot.findUnique({ where: { id: botId }, select: { token: true, paymentFlow: true } }),
      prisma.user.findUnique({ where: { id: transaction.userId }, select: { telegramId: true } })
    ]);

    if (!bot || !user) {
      res.status(404).json({ error: "Bot or user not found" });
      return;
    }

    const token = bot.token;
    const chatId = String(user.telegramId);
    const flow = normalizePaymentFlow(bot.paymentFlow);
    const deliverables = flow.deliverables ?? [];

    let delivered = 0;

    for (const step of deliverables) {
      if (step.delayMs > 0) {
        await new Promise((r) => setTimeout(r, step.delayMs));
      }

      const inlineKeyboard = step.buttons.length > 0
        ? { inline_keyboard: step.buttons.map((btn: MessageButton) => [{ text: btn.label, ...(btn.action === "OPEN_URL" && btn.url ? { url: btn.url } : { callback_data: `deliverable:${btn.id}` }) }]) }
        : undefined;

      let method: string;
      let body: Record<string, unknown>;

      switch (step.type) {
        case "AUDIO":
          method = "sendVoice";
          body = { chat_id: chatId, voice: step.mediaUrls[0] ?? "", caption: step.text ?? "", parse_mode: "HTML" };
          break;
        case "IMAGE":
          method = "sendPhoto";
          body = { chat_id: chatId, photo: step.mediaUrls[0] ?? "", caption: step.text ?? "", parse_mode: "HTML" };
          break;
        case "VIDEO":
          method = "sendVideo";
          body = { chat_id: chatId, video: step.mediaUrls[0] ?? "", caption: step.text ?? "", parse_mode: "HTML" };
          break;
        default:
          method = "sendMessage";
          body = { chat_id: chatId, text: step.text ?? step.title, parse_mode: "HTML" };
      }

      if (inlineKeyboard) {
        body.reply_markup = inlineKeyboard;
      }

      const tgResp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!tgResp.ok) {
        const errBody = await tgResp.text().catch(() => "");
        logger.error(`[simulate-confirm] Telegram ${method} failed: ${tgResp.status} - ${errBody}`);
      } else {
        delivered++;
      }
    }

    res.json({ ok: true, status: "COMPLETED", delivered });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    logger.error(`[simulate-confirm] ${message}`);
    res.status(500).json({ error: message });
  }
});

app.use(express.static(publicDir));
app.get(/^\/(?!api|webhook).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"), (error) => {
    if (error) res.status(404).json({ error: "Dashboard build not found" });
  });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  const status = error instanceof HttpError ? error.status : 500;
  const message = status === 500 && env.nodeEnv === "production" ? "Internal server error" : error.message;
  if (status === 500) logger.error(`[${label}] ${error.message}`);
  res.status(status).json({ error: message });
});

const server = app.listen(env.appPort, async () => {
  try {
    const skipWebhook = !isPrimaryWorker || process.env.SKIP_WEBHOOK === "true";
    await loadActiveBots(env, skipWebhook);
    if (isPrimaryWorker) {
      startRemarketingPoller();
      startPaymentPoller();
    }
    logger.info(`[${label}] Listening on ${env.appPort}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "startup failed";
    logger.error(`[${label}] ${message}`);
    process.exitCode = 1;
    server.close();
  }
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`[${label}] Received ${signal}, shutting down`);
  if (isPrimaryWorker) {
    stopRemarketingPoller();
    stopPaymentPoller();
  }
  server.close(async () => {
    try {
      await shutdownAllBots();
      await prisma.$disconnect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "shutdown failed";
      logger.error(`[${label}] ${message}`);
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

export { app };
