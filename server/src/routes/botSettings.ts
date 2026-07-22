import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../utils/errors.js";
import { prisma } from "../services/prisma.js";
import { serializeJson } from "../utils/serialize.js";
import { normalizeBotSettings, type BotSettings } from "../bot/botSettings.js";

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

export function botSettingsRouter(): Router {
  const router = Router();

  router.get("/bots/:id/settings", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (!bot) throw new HttpError(404, "Bot not found");
    res.json(serializeJson(normalizeBotSettings(bot.settings)));
  }));

  router.put("/bots/:id/settings", route(async (req, res) => {
    const botId = routeParam(req, "id");
    const existing = await prisma.bot.findUnique({ where: { id: botId } });
    if (!existing) throw new HttpError(404, "Bot not found");

    const settings = normalizeBotSettings(req.body);
    await prisma.bot.update({ where: { id: botId }, data: { settings } });
    res.json(serializeJson(settings));
  }));

  return router;
}
