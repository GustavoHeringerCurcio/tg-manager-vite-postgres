import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../utils/errors.js";
import { prisma } from "../services/prisma.js";
import { serializeJson } from "../utils/serialize.js";
import { testPixelEvent } from "../services/facebookPixel.js";

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

type PixelConfigBody = {
  pixelId?: string;
  accessToken?: string;
  enabled?: boolean;
};

export function facebookPixelRouter(): Router {
  const router = Router();

  router.get("/bots/:id/pixel", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    res.json(serializeJson({
      pixelId: bot.fbPixelId ?? null,
      hasToken: Boolean(bot.fbAccessToken?.trim()),
      enabled: bot.fbEnabled
    }));
  }));

  router.put("/bots/:id/pixel", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    const body = req.body as PixelConfigBody;
    if (!body.pixelId || !body.pixelId.trim()) {
      throw new HttpError(400, "pixelId is required");
    }
    if (!body.accessToken || !body.accessToken.trim()) {
      throw new HttpError(400, "accessToken is required");
    }
    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        fbPixelId: body.pixelId.trim(),
        fbAccessToken: body.accessToken.trim(),
        fbEnabled: enabled
      }
    });
    res.json(serializeJson({ pixelId: body.pixelId.trim(), hasToken: true, enabled }));
  }));

  router.delete("/bots/:id/pixel", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    await prisma.bot.update({
      where: { id: bot.id },
      data: { fbPixelId: null, fbAccessToken: null, fbEnabled: false }
    });
    res.status(204).send();
  }));

  router.post("/bots/:id/pixel/test", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    const result = await testPixelEvent(bot.id, bot.fbPixelId, bot.fbAccessToken, bot.fbEnabled, undefined);
    res.json(serializeJson(result));
  }));

  return router;
}
