import type { Prisma } from "@prisma/client";
import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../utils/errors.js";
import { parsePagination, serializeJson } from "../utils/serialize.js";
import { prisma } from "../services/prisma.js";
import { cancelRemarketingForUser } from "../bot/handlers.js";

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function route(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function chatRouter(): Router {
  const router = Router();

  router.get("/bots/:id/sessions", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const pagination = parsePagination(req.query as Record<string, string | undefined>);
    const query = req.query as Record<string, string | undefined>;
    const status = cleanString(query.status);
    const userId = cleanString(query.userId);
    const search = cleanString(query.search);
    const where: Prisma.UserSessionWhereInput = {
      botId,
      ...(status ? { status } : {}),
      ...(userId ? { userId } : {}),
      ...(search ? {
        user: {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ]
        }
      } : {})
    };
    const [items, total] = await Promise.all([
      prisma.userSession.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: { user: true }
      }),
      prisma.userSession.count({ where })
    ]);
    res.json(serializeJson({ items, total, page: pagination.page, pageSize: pagination.pageSize }));
  }));

  router.get("/bots/:id/sessions/:sid/chat", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const sessionId = routeParam(req, "sid");
    const session = await prisma.userSession.findFirst({
      where: { id: sessionId, botId }
    });
    if (!session) throw new HttpError(404, "Session not found");

    const sessionInteractions = await prisma.interaction.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" }
    });

    const remarketingInteractions = await prisma.interaction.findMany({
      where: {
        botId,
        userId: session.userId,
        sessionId: null,
        createdAt: {
          gte: session.startedAt,
          ...(session.endedAt ? { lte: session.endedAt } : {})
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const allInteractions = [...sessionInteractions, ...remarketingInteractions]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const timeline = allInteractions.map((item) => ({
      id: item.id,
      direction: item.direction,
      type: item.type,
      content: item.content,
      stepIndex: item.stepIndex,
      buttonId: item.buttonId,
      messageId: item.messageId ? String(item.messageId) : null,
      chatId: item.chatId ? String(item.chatId) : null,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString()
    }));

    res.json(serializeJson(timeline));
  }));

  router.get("/bots/:id/users", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const pagination = parsePagination(req.query as Record<string, string | undefined>);
    const query = req.query as Record<string, string | undefined>;
    const where: Prisma.UserWhereInput = {
      botId,
      ...(cleanString(query.isBlocked) ? { isBlocked: query.isBlocked === "true" } : {}),
      ...(cleanString(query.search) ? {
        OR: [
          { username: { contains: query.search, mode: "insensitive" } },
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { lastInteraction: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: { _count: { select: { sessions: true, transactions: true } } }
      }),
      prisma.user.count({ where })
    ]);
    const sanitized = items.map(({ _count, ...user }) => ({
      ...user,
      sessionCount: _count.sessions,
      transactionCount: _count.transactions
    }));
    res.json(serializeJson({ items: sanitized, total, page: pagination.page, pageSize: pagination.pageSize }));
  }));

  router.get("/bots/:id/users/:uid", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const userId = routeParam(req, "uid");
    const user = await prisma.user.findFirst({
      where: { id: userId, botId }
    });
    if (!user) throw new HttpError(404, "User not found");

    const [sessions, sessionsTotal] = await Promise.all([
      prisma.userSession.findMany({
        where: { userId, botId },
        orderBy: { startedAt: "desc" },
        take: 50
      }),
      prisma.userSession.count({ where: { userId, botId } })
    ]);

    res.json(serializeJson({ ...user, sessions, sessionsTotal }));
  }));

  router.patch("/bots/:id/users/:uid", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const userId = routeParam(req, "uid");
    const existing = await prisma.user.findFirst({ where: { id: userId, botId } });
    if (!existing) throw new HttpError(404, "User not found");

    const body = req.body as Record<string, unknown>;
    const data: Prisma.UserUpdateInput = {};

    if (typeof body.tags === "object") data.tags = body.tags as Prisma.InputJsonValue;
    if (typeof body.notes === "string") data.notes = body.notes;
    if (typeof body.isBlocked === "boolean") data.isBlocked = body.isBlocked;
    if (typeof body.settings === "object") data.settings = body.settings as Prisma.InputJsonValue;

    const updated = await prisma.user.update({ where: { id: userId }, data });
    res.json(serializeJson(updated));
  }));

  router.post("/utils/test-remarketing-cancel", route(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const botId = typeof body.botId === "string" ? body.botId.trim() : "";
    const targetId = typeof body.userOrChatId === "string" ? body.userOrChatId.trim() : "";

    if (!botId || !targetId) {
      res.status(400).json(serializeJson({ ok: false, error: "botId and userOrChatId are required" }));
      return;
    }

    try {
      let user = await prisma.user.findFirst({ where: { botId, id: targetId } });
      if (!user && /^\d+$/.test(targetId)) {
        const telegramId = BigInt(targetId);
        user = await prisma.user.findFirst({ where: { botId, telegramId } });
      }
      if (!user) {
        res.status(404).json(serializeJson({ ok: false, error: "User not found for provided identifiers", botId, targetId }));
        return;
      }

      // Upsert a pending remarketing state for this user (mock)
      const nextSendAt = new Date(Date.now() + 60_000);
      await prisma.remarketingState.upsert({
        where: { userId_botId: { userId: user.id, botId } },
        update: { nextIndex: 0, nextSendAt },
        create: { botId, userId: user.id, nextIndex: 0, totalSent: 0, nextSendAt }
      });

      const cancelled = await cancelRemarketingForUser(botId, user.id).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[utils:test-cancel] cancellation failed`, { botId, userId: user?.id, targetId, error: msg });
        return -1;
      });

      const remaining = await prisma.remarketingState.findFirst({ where: { botId, userId: user.id } });
      const wasCancelled = cancelled > 0 && !remaining;

      res.json(serializeJson({
        ok: true,
        botId,
        userId: user.id,
        telegramId: user.telegramId?.toString() ?? null,
        createdMock: true,
        cancelledCount: cancelled,
        remainingExists: Boolean(remaining),
        cancelled: wasCancelled
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "test cancellation failed";
      console.error(`[utils:test-cancel] ${message}`, { botId, targetId });
      res.status(500).json(serializeJson({ ok: false, error: message, botId, targetId }));
    }
  }));

  return router;
}
