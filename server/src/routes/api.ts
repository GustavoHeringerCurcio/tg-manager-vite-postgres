import { BotStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import type { Request } from "express";
import { Telegraf } from "telegraf";
import type { AppEnv } from "../utils/env.js";
import { HttpError } from "../utils/errors.js";
import { isButtonStyle, parsePagination, sanitizeBot, sanitizeBots, serializeJson } from "../utils/serialize.js";
import { encryptToken } from "../services/crypto.js";
import { prisma } from "../services/prisma.js";
import { startBot, stopBot } from "../services/botLifecycle.js";

type BotBody = {
  name?: string;
  token?: string;
  welcomeVideoUrl?: string;
  welcomeText?: string;
  checkoutButtonText?: string;
  checkoutButtonStyle?: string;
  supportButtonText?: string;
  supportButtonStyle?: string;
  supportUrl?: string;
  checkoutAmount?: number;
};

type StatusBody = { status?: string };

function readBody<T>(req: Request): T {
  return req.body as T;
}

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function validateStyle(value: string | undefined, field: string): string | undefined {
  if (!value) return undefined;
  if (!isButtonStyle(value)) throw new HttpError(400, `${field} must be primary, success, or danger`);
  return value;
}

function validateUrl(value: string | undefined): string | undefined {
  const clean = cleanString(value);
  if (!clean) return undefined;
  try {
    const url = new URL(clean);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid URL protocol");
    return clean;
  } catch {
    throw new HttpError(400, "supportUrl must be a valid URL");
  }
}

async function validateTelegramToken(token: string): Promise<void> {
  try {
    await new Telegraf(token).telegram.getMe();
  } catch {
    throw new HttpError(400, "Telegram bot token is invalid or unreachable");
  }
}

function botData(body: BotBody, env: AppEnv, requireToken: boolean): Prisma.BotCreateInput | Prisma.BotUpdateInput {
  const name = cleanString(body.name);
  if (!name) throw new HttpError(400, "name is required");
  if (requireToken && !cleanString(body.token)) throw new HttpError(400, "token is required");
  if (body.checkoutAmount !== undefined && (!Number.isFinite(body.checkoutAmount) || body.checkoutAmount <= 0)) {
    throw new HttpError(400, "checkoutAmount must be positive");
  }
  const data: Prisma.BotCreateInput | Prisma.BotUpdateInput = {
    name,
    welcomeVideoUrl: cleanString(body.welcomeVideoUrl) ?? null,
    welcomeText: cleanString(body.welcomeText) ?? null,
    checkoutButtonText: cleanString(body.checkoutButtonText) ?? "Pagar agora",
    checkoutButtonStyle: validateStyle(body.checkoutButtonStyle, "checkoutButtonStyle") ?? "primary",
    supportButtonText: cleanString(body.supportButtonText) ?? "Suporte",
    supportButtonStyle: validateStyle(body.supportButtonStyle, "supportButtonStyle") ?? "primary",
    supportUrl: validateUrl(body.supportUrl) ?? null,
    checkoutAmount: body.checkoutAmount ?? 29.9
  };
  const token = cleanString(body.token);
  if (token) data.token = encryptToken(token, env.encryptionKey);
  return data;
}

export function apiRouter(env: AppEnv): Router {
  const router = Router();

  router.get("/bots", async (_req, res) => {
    const bots = await prisma.bot.findMany({ orderBy: { createdAt: "desc" } });
    res.json(serializeJson(sanitizeBots(bots)));
  });

  router.get("/bots/:id", async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: req.params.id } });
    if (!bot) throw new HttpError(404, "Bot not found");
    res.json(serializeJson(sanitizeBot(bot)));
  });

  router.post("/bots", async (req, res) => {
    let created: Awaited<ReturnType<typeof prisma.bot.create>> | undefined;
    try {
      const body = readBody<BotBody>(req);
      const token = cleanString(body.token);
      if (!token) throw new HttpError(400, "token is required");
      await validateTelegramToken(token);
      created = await prisma.bot.create({ data: botData(body, env, true) as Prisma.BotCreateInput });
      await startBot(created, env);
    } catch (error) {
      if (created) {
        const isLocalhost = env.domain === "localhost" || env.domain === "127.0.0.1" || env.domain.startsWith("localhost:");
        if (isLocalhost) {
          console.warn(`[api] Bot "${created.name}" created but webhook skipped: DOMAIN is set to localhost. Use a public domain for Telegram webhooks.`);
          res.status(201).json(serializeJson(sanitizeBot(created)));
          return;
        }
        await prisma.bot.delete({ where: { id: created.id } }).catch(() => {});
      }
      const message = error instanceof Error ? error.message : "Could not create bot";
      const status = error instanceof HttpError ? error.status : 500;
      throw new HttpError(status, message);
    }
    res.status(201).json(serializeJson(sanitizeBot(created)));
  });

  router.put("/bots/:id", async (req, res) => {
    const existing = await prisma.bot.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Bot not found");
    const body = readBody<BotBody>(req);
    const token = cleanString(body.token);
    if (token) await validateTelegramToken(token);
    const updated = await prisma.bot.update({ where: { id: existing.id }, data: botData(body, env, false) as Prisma.BotUpdateInput });
    if (updated.status === BotStatus.ACTIVE) {
      await stopBot(updated.id);
      await startBot(updated, env);
    }
    res.json(serializeJson(sanitizeBot(updated)));
  });

  router.patch("/bots/:id/status", async (req, res) => {
    const body = readBody<StatusBody>(req);
    if (body.status !== BotStatus.ACTIVE && body.status !== BotStatus.INACTIVE && body.status !== BotStatus.SUSPENDED) {
      throw new HttpError(400, "status must be ACTIVE, INACTIVE, or SUSPENDED");
    }
    const existing = await prisma.bot.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Bot not found");
    const updated = await prisma.bot.update({ where: { id: existing.id }, data: { status: body.status } });
    if (updated.status === BotStatus.ACTIVE) await startBot(updated, env);
    if (updated.status !== BotStatus.ACTIVE) await stopBot(updated.id);
    res.json(serializeJson(sanitizeBot(updated)));
  });

  router.delete("/bots/:id", async (req, res) => {
    const existing = await prisma.bot.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "Bot not found");
    await stopBot(existing.id);
    await prisma.bot.delete({ where: { id: existing.id } });
    res.status(204).send();
  });

  router.get("/bots/:id/transactions", async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, string | undefined>);
    const status = cleanString(req.query.status as string | undefined);
    const where: Prisma.TransactionWhereInput = { botId: req.params.id, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take, include: { user: true } }),
      prisma.transaction.count({ where })
    ]);
    res.json(serializeJson({ items, total, page: pagination.page, pageSize: pagination.pageSize }));
  });

  router.get("/bots/:id/interactions", async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, string | undefined>);
    const query = req.query as Record<string, string | undefined>;
    const where: Prisma.InteractionWhereInput = {
      botId: req.params.id,
      ...(cleanString(query.userId) ? { userId: cleanString(query.userId) } : {}),
      ...(cleanString(query.type) ? { type: cleanString(query.type) } : {}),
      ...((cleanString(query.from) || cleanString(query.to)) ? { createdAt: { gte: cleanString(query.from) ? new Date(String(query.from)) : undefined, lte: cleanString(query.to) ? new Date(String(query.to)) : undefined } } : {})
    };
    const [items, total] = await Promise.all([
      prisma.interaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take, include: { user: true } }),
      prisma.interaction.count({ where })
    ]);
    res.json(serializeJson({ items, total, page: pagination.page, pageSize: pagination.pageSize }));
  });

  router.get("/bots/:id/interactions/stats", async (req, res) => {
    const [totalInteractions, totalUsers, checkoutClicks, messageCount, callbackCount, dailyActiveUsers] = await Promise.all([
      prisma.interaction.count({ where: { botId: req.params.id } }),
      prisma.user.count({ where: { botId: req.params.id } }),
      prisma.interaction.count({ where: { botId: req.params.id, type: "callback_query", content: "checkout" } }),
      prisma.interaction.count({ where: { botId: req.params.id, type: "message" } }),
      prisma.interaction.count({ where: { botId: req.params.id, type: "callback_query" } }),
      prisma.user.count({ where: { botId: req.params.id, lastInteraction: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    ]);
    res.json({ totalInteractions, totalUsers, checkoutClicks, messageCount, callbackCount, dailyActiveUsers });
  });

  return router;
}
