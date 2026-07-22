import { BotStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Telegraf } from "telegraf";
import type { AppEnv } from "../utils/env.js";
import { HttpError } from "../utils/errors.js";
import { parsePagination, sanitizeBot, sanitizeBots, serializeJson, type SafeBot } from "../utils/serialize.js";
import { prisma } from "../services/prisma.js";
import { startBot, stopBot } from "../services/botLifecycle.js";
import { defaultMessageFlow, normalizeMessageFlow, type MessageButton, type MessageStep } from "../bot/messageFlow.js";
import { defaultPaymentFlow, isPaymentFlowConfigured, normalizePaymentFlow } from "../bot/paymentFlow.js";
import { defaultRemarketing, normalizeRemarketing, defaultTimeCompliments, normalizeTimeCompliments, getDiscountPercentage } from "../bot/remarketing.js";
import { normalizeBotSettings } from "../bot/botSettings.js";

type BotBody = {
  name?: string;
  token?: string;
  messageFlow?: unknown;
  remarketing?: unknown;
  paymentFlow?: unknown;
  timeCompliments?: unknown;
  photoUrl?: string | null;
};

type StatusBody = { status?: string };
type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function route(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

function readBody<T>(req: Request): T {
  return req.body as T;
}

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function hasLivepixButtons(steps: MessageStep[]): boolean {
  return steps.some(step => step.buttons.some(button => button.action === "LIVEPIX_PAYMENT"));
}

function checkLivepixConfiguredForFlow(steps: unknown, paymentFlow: unknown, existingBot: { paymentFlow: unknown } | null): void {
  const normalized = normalizeMessageFlow(steps);
  if (!hasLivepixButtons(normalized)) return;
  const flow = existingBot && paymentFlow === undefined ? normalizePaymentFlow(existingBot.paymentFlow) : normalizePaymentFlow(paymentFlow);
  if (!isPaymentFlowConfigured(flow)) {
    throw new HttpError(400, "Configure os passos de pagamento no LivePix antes de usar botões de pagamento.");
  }
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
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
  const data: Prisma.BotCreateInput | Prisma.BotUpdateInput = { name };
  if (body.messageFlow !== undefined) {
    try {
      data.messageFlow = normalizeMessageFlow(body.messageFlow) as Prisma.InputJsonValue;
    } catch (error) {
      const message = error instanceof Error ? error.message : "messageFlow is invalid";
      throw new HttpError(400, message);
    }
  } else if (requireToken) {
    data.messageFlow = defaultMessageFlow() as Prisma.InputJsonValue;
  }
  if (body.remarketing !== undefined) {
    try {
      data.remarketing = normalizeRemarketing(body.remarketing) as Prisma.InputJsonValue;
    } catch (error) {
      const message = error instanceof Error ? error.message : "remarketing is invalid";
      throw new HttpError(400, message);
    }
  } else if (requireToken) {
    data.remarketing = defaultRemarketing() as Prisma.InputJsonValue;
  }
  if (body.paymentFlow !== undefined) {
    try {
      data.paymentFlow = normalizePaymentFlow(body.paymentFlow) as Prisma.InputJsonValue;
    } catch (error) {
      const message = error instanceof Error ? error.message : "paymentFlow is invalid";
      throw new HttpError(400, message);
    }
  } else if (requireToken) {
    data.paymentFlow = defaultPaymentFlow() as Prisma.InputJsonValue;
  }
  if (body.timeCompliments !== undefined) {
    try {
      data.timeCompliments = normalizeTimeCompliments(body.timeCompliments) as Prisma.InputJsonValue;
    } catch (error) {
      const message = error instanceof Error ? error.message : "timeCompliments is invalid";
      throw new HttpError(400, message);
    }
  } else if (requireToken) {
    data.timeCompliments = defaultTimeCompliments() as Prisma.InputJsonValue;
  }
  const token = cleanString(body.token);
  if (token) data.token = token;
  if (body.photoUrl !== undefined) {
    data.photoUrl = cleanString(body.photoUrl ?? undefined) ?? null;
  }
  return data;
}

export function apiRouter(env: AppEnv): Router {
  const router = Router();

  router.get("/bots", route(async (_req, res) => {
    const bots = await prisma.bot.findMany({ orderBy: { createdAt: "desc" } });
    const normalized = bots.map(b => {
      const flow = normalizePaymentFlow(b.paymentFlow);
      const botSettings = normalizeBotSettings(b.settings);
      return { ...b, timeCompliments: normalizeTimeCompliments(b.timeCompliments, botSettings.timezone), livepixConfigured: isPaymentFlowConfigured(flow) };
    });
    res.json(serializeJson(sanitizeBots(normalized)));
  }));

  router.get("/bots/:id", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    const flow = normalizePaymentFlow(bot.paymentFlow);
    const botSettings = normalizeBotSettings(bot.settings);
    const normalized = { ...bot, timeCompliments: normalizeTimeCompliments(bot.timeCompliments, botSettings.timezone), livepixConfigured: isPaymentFlowConfigured(flow) };
    res.json(serializeJson(sanitizeBot(normalized)));
  }));

  router.post("/bots", route(async (req, res) => {
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
          const cFlow = normalizePaymentFlow(created.paymentFlow);
          res.status(201).json(serializeJson(sanitizeBot({ ...created, livepixConfigured: isPaymentFlowConfigured(cFlow) })));
          return;
        }
        await prisma.bot.delete({ where: { id: created.id } }).catch(() => {});
      }
      const message = error instanceof Error ? error.message : "Could not create bot";
      const status = error instanceof HttpError ? error.status : 500;
      throw new HttpError(status, message);
    }
    const cFlow = normalizePaymentFlow(created.paymentFlow);
    res.status(201).json(serializeJson(sanitizeBot({ ...created, livepixConfigured: isPaymentFlowConfigured(cFlow) })));
  }));

  router.put("/bots/:id", route(async (req, res) => {
    const existing = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!existing) throw new HttpError(404, "Bot not found");
    const body = readBody<BotBody>(req);
    const token = cleanString(body.token);
    if (token) await validateTelegramToken(token);
    if (body.messageFlow !== undefined) {
      checkLivepixConfiguredForFlow(body.messageFlow, body.paymentFlow, existing as unknown as { paymentFlow: unknown });
    }
    if (body.remarketing !== undefined && typeof body.remarketing === "object" && body.remarketing !== null) {
      const rm = body.remarketing as Record<string, unknown>;
      if (rm.messages !== undefined) {
        checkLivepixConfiguredForFlow(rm.messages, body.paymentFlow, existing as unknown as { paymentFlow: unknown });
      }
    }
    const updated = await prisma.bot.update({ where: { id: existing.id }, data: botData(body, env, false) as Prisma.BotUpdateInput });
    if (updated.status === BotStatus.ACTIVE) {
      await stopBot(updated.id);
      await startBot(updated, env);
    }
    const uFlow = normalizePaymentFlow(updated.paymentFlow);
    res.json(serializeJson(sanitizeBot({ ...updated, livepixConfigured: isPaymentFlowConfigured(uFlow) })));
  }));

  router.patch("/bots/:id/status", route(async (req, res) => {
    const body = readBody<StatusBody>(req);
    if (body.status !== BotStatus.ACTIVE && body.status !== BotStatus.INACTIVE && body.status !== BotStatus.SUSPENDED) {
      throw new HttpError(400, "status must be ACTIVE, INACTIVE, or SUSPENDED");
    }
    const existing = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!existing) throw new HttpError(404, "Bot not found");
    const updated = await prisma.bot.update({ where: { id: existing.id }, data: { status: body.status } });
    if (updated.status === BotStatus.ACTIVE) await startBot(updated, env);
    if (updated.status !== BotStatus.ACTIVE) await stopBot(updated.id);
    res.json(serializeJson(sanitizeBot(updated)));
  }));

  router.delete("/bots/:id", route(async (req, res) => {
    const existing = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!existing) throw new HttpError(404, "Bot not found");
    await stopBot(existing.id);
    await prisma.bot.delete({ where: { id: existing.id } });
    res.status(204).send();
  }));

  router.get("/bots/:id/transactions", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const pagination = parsePagination(req.query as Record<string, string | undefined>);
    const status = cleanString(req.query.status as string | undefined);
    const where: Prisma.TransactionWhereInput = { botId, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take, include: { user: true } }),
      prisma.transaction.count({ where })
    ]);
    res.json(serializeJson({ items, total, page: pagination.page, pageSize: pagination.pageSize }));
  }));

  router.get("/bots/:id/interactions", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const pagination = parsePagination(req.query as Record<string, string | undefined>);
    const query = req.query as Record<string, string | undefined>;
    const where: Prisma.InteractionWhereInput = {
      botId,
      ...(cleanString(query.userId) ? { userId: cleanString(query.userId) } : {}),
      ...(cleanString(query.type) ? { type: cleanString(query.type) } : {}),
      ...((cleanString(query.from) || cleanString(query.to)) ? { createdAt: { gte: cleanString(query.from) ? new Date(String(query.from)) : undefined, lte: cleanString(query.to) ? new Date(String(query.to)) : undefined } } : {})
    };
    const [items, total] = await Promise.all([
      prisma.interaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take, include: { user: true } }),
      prisma.interaction.count({ where })
    ]);
    res.json(serializeJson({ items, total, page: pagination.page, pageSize: pagination.pageSize }));
  }));

  router.get("/bots/:id/interactions/stats", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const [totalInteractions, totalUsers, checkoutClicks, messageCount, callbackCount, dailyActiveUsers] = await Promise.all([
      prisma.interaction.count({ where: { botId } }),
      prisma.user.count({ where: { botId } }),
      prisma.interaction.count({ where: { botId, type: "callback_query", content: { startsWith: "livepix_payment:" } } }),
      prisma.interaction.count({ where: { botId, type: "message" } }),
      prisma.interaction.count({ where: { botId, type: "callback_query" } }),
      prisma.user.count({ where: { botId, lastInteraction: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    ]);
    res.json({ totalInteractions, totalUsers, checkoutClicks, messageCount, callbackCount, dailyActiveUsers });
  }));

  router.get("/bots/:id/remarketing-states", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const pagination = parsePagination(req.query as Record<string, string | undefined>);
    const statusFilter = cleanString(req.query.status as string | undefined);
    const where: Prisma.RemarketingStateWhereInput = {
      botId,
      ...(statusFilter === "active" ? { nextSendAt: { not: null } } : {}),
      ...(statusFilter === "cancelled" ? { nextSendAt: null } : {})
    };
    const [items, total, bot] = await Promise.all([
      prisma.remarketingState.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: { user: true }
      }),
      prisma.remarketingState.count({ where }),
      prisma.bot.findUnique({ where: { id: botId } })
    ]);
    const config = bot ? normalizeRemarketing(bot.remarketing) : null;
    res.json(serializeJson({
      items,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      config: config ? {
        intervalMs: config.intervalMs,
        maxSends: config.maxSends,
        messageCount: config.messages.length,
        messageTitles: config.messages.map(m => m.title),
        discountOffer: config.discountOffer
      } : null,
      serverTime: new Date().toISOString()
    }));
  }));

  router.post("/bots/:id/remarketing-states/cancel-all", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const result = await prisma.remarketingState.updateMany({
      where: { botId, nextSendAt: { not: null } },
      data: { nextSendAt: null }
    });
    res.json({ count: result.count });
  }));

  router.get("/bots/:id/remarketing-states/export", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    const config = bot ? normalizeRemarketing(bot.remarketing) : null;
    const states = await prisma.remarketingState.findMany({
      where: { botId },
      orderBy: { updatedAt: "desc" },
      include: { user: true }
    });
    const headers = [
      "Username", "Telegram ID", "First Name", "Status",
      "Messages Sent", "Max Sends", "Next Message", "Next Send At",
      "Discount Active", "Cycle", "Created At", "Updated At"
    ];
    const cycleCount = config?.messages.length ?? 0;
    const rows = states.map(s => {
      const isActive = s.nextSendAt !== null;
      const nextMsgTitle = config && cycleCount > 0
        ? config.messages[s.nextIndex % cycleCount]?.title ?? "—"
        : "—";
      const discountActive = config?.discountOffer?.enabled
        ? getDiscountPercentage(config.discountOffer, s.totalSent) > 0
        : false;
      const cycle = cycleCount > 0 ? Math.floor(s.totalSent / cycleCount) + 1 : 1;
      return [
        s.user.username ?? "",
        String(s.user.telegramId),
        s.user.firstName ?? "",
        isActive ? "Active" : "Cancelled",
        String(s.totalSent),
        config?.maxSends ? String(config.maxSends) : "∞",
        nextMsgTitle,
        s.nextSendAt ? s.nextSendAt.toISOString() : "—",
        discountActive ? "Yes" : "No",
        String(cycle),
        s.createdAt.toISOString(),
        s.updatedAt.toISOString()
      ];
    });
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="remarketing-${botId}.csv"`);
    res.send("\uFEFF" + csv);
  }));

  router.patch("/bots/:id/remarketing-states/:userId", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const userId = routeParam(req, "userId");
    const body = req.body as { active?: boolean };
    if (typeof body.active !== "boolean") {
      throw new HttpError(400, "active must be a boolean");
    }
    if (body.active) {
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot) throw new HttpError(404, "Bot not found");
      const config = normalizeRemarketing(bot.remarketing);
      await prisma.remarketingState.upsert({
        where: { userId_botId: { userId, botId } },
        create: {
          botId,
          userId,
          nextIndex: 0,
          totalSent: 0,
          nextSendAt: new Date(Date.now() + config.intervalMs)
        },
        update: {
          nextSendAt: new Date(Date.now() + config.intervalMs)
        }
      });
    } else {
      const existing = await prisma.remarketingState.findUnique({ where: { userId_botId: { userId, botId } } });
      if (!existing) throw new HttpError(404, "Remarketing state not found");
      await prisma.remarketingState.update({
        where: { userId_botId: { userId, botId } },
        data: { nextSendAt: null }
      });
    }
    res.json({ ok: true });
  }));

  return router;
}
