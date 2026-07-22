import "dotenv/config";
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
import { prisma } from "./services/prisma.js";
import { loadActiveBots, shutdownAllBots } from "./services/botLifecycle.js";
import { startRemarketingPoller, stopRemarketingPoller } from "./services/remarketingScheduler.js";
import { startPaymentPoller, stopPaymentPoller } from "./services/paymentPoller.js";
import { normalizePaymentFlow } from "./bot/paymentFlow.js";

const env = loadEnv();
const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(dirname, "../public");

app.use(express.json({ limit: "1mb" }));
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

app.use("/api", adminAuth(env.adminPassword), apiRouter(env));
app.use("/api", adminAuth(env.adminPassword), chatRouter());
app.use("/api", adminAuth(env.adminPassword), facebookPixelRouter());
app.use("/api", adminAuth(env.adminPassword), botSettingsRouter(env));

app.post("/api/bots/:botId/payment/pix-copied", adminAuth(env.adminPassword), async (req: Request, res: Response) => {
  try {
    const botId = String(req.params.botId ?? "");
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";

    if (!botId || !sessionId) {
      res.status(400).json({ error: "Invalid botId or sessionId" });
      return;
    }

    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { id: true, botId: true, userId: true }
    });

    if (!session || session.botId !== botId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const [bot, user] = await Promise.all([
      prisma.bot.findUnique({ where: { id: botId }, select: { id: true, token: true, paymentFlow: true } }),
      prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, telegramId: true } })
    ]);

    if (!bot || !user) {
      res.status(404).json({ error: "Bot or user not found" });
      return;
    }

    const flow = normalizePaymentFlow(bot.paymentFlow);

    if (!flow.isCopyPixAudioEnabled) {
      res.json({ ok: true, sent: false, reason: "disabled" });
      return;
    }

    const audios = Array.isArray(flow.copyPixAudios) ? flow.copyPixAudios.filter((x) => typeof x === "string" && x.trim()) : [];
    if (audios.length === 0) {
      res.json({ ok: true, sent: false, reason: "no_audios" });
      return;
    }

    const fileId = audios[Math.floor(Math.random() * audios.length)]!;
    const chatId = String(user.telegramId);

    try {
      const tgResp = await fetch(`https://api.telegram.org/bot${bot.token}/sendVoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, voice: fileId })
      });

      if (!tgResp.ok) {
        const body = await tgResp.text().catch(() => "");
        console.error(`[pix-copied] Telegram API error ${tgResp.status} ${tgResp.statusText} - ${body}`);
        res.json({ ok: false, sent: false, error: "telegram_error" });
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pix-copied] Telegram request failed: ${message}`);
      res.json({ ok: false, sent: false, error: "telegram_request_failed" });
      return;
    }

    res.json({ ok: true, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    console.error(`[pix-copied] ${message}`);
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
  if (status === 500) console.error(`[server] ${error.message}`);
  res.status(status).json({ error: message });
});

const server = app.listen(env.appPort, async () => {
  try {
    await loadActiveBots(env);
    startRemarketingPoller();
    startPaymentPoller();
    console.log(`[server] Listening on ${env.appPort}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "startup failed";
    console.error(`[server] ${message}`);
    process.exitCode = 1;
    server.close();
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] Received ${signal}, shutting down`);
  stopRemarketingPoller();
  stopPaymentPoller();
  server.close(async () => {
    try {
      await shutdownAllBots();
      await prisma.$disconnect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "shutdown failed";
      console.error(`[server] ${message}`);
    } finally {
      process.exit(0);
    }
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export { app };
