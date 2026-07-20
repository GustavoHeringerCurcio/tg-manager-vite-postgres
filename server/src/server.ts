import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { adminAuth } from "./middleware/auth.js";
import { webhookDispatcher } from "./middleware/webhook.js";
import { apiRouter } from "./routes/api.js";
import { chatRouter } from "./routes/chat.js";
import { loadEnv } from "./utils/env.js";
import { HttpError } from "./utils/errors.js";
import { prisma } from "./services/prisma.js";
import { loadActiveBots, shutdownAllBots } from "./services/botLifecycle.js";
import { startRemarketingPoller, stopRemarketingPoller } from "./services/remarketingScheduler.js";

const env = loadEnv();
const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(dirname, "../public");

app.use(express.json({ limit: "1mb" }));
app.post("/webhook/:botId", webhookDispatcher);

app.get("/api/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, uptime: process.uptime(), database: "ok" });
});

app.use("/api", adminAuth(env.adminPassword), apiRouter(env));
app.use("/api", adminAuth(env.adminPassword), chatRouter());

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
  if (status === 500) console.error(error);
  res.status(status).json({ error: message });
});

const server = app.listen(env.appPort, async () => {
  try {
    await loadActiveBots(env);
    startRemarketingPoller();
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
  server.close(async () => {
    await shutdownAllBots();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export { app };
