import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "../utils/errors.js";
import { prisma } from "../services/prisma.js";
import { serializeJson } from "../utils/serialize.js";
import { sendUtmifyOrder } from "../services/utmify.js";

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

export function utmifyRouter(): Router {
  const router = Router();

  router.get("/bots/:id/utmify", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    res.json(serializeJson({
      hasToken: Boolean(bot.utmifyApiToken?.trim()),
      enabled: bot.utmifyEnabled
    }));
  }));

  router.put("/bots/:id/utmify", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    const body = req.body as { apiToken?: string; enabled?: boolean };
    if (!body.apiToken || !body.apiToken.trim()) {
      throw new HttpError(400, "apiToken is required");
    }
    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
    await prisma.bot.update({
      where: { id: bot.id },
      data: {
        utmifyApiToken: body.apiToken.trim(),
        utmifyEnabled: enabled
      }
    });
    res.json(serializeJson({ hasToken: true, enabled }));
  }));

  router.delete("/bots/:id/utmify", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");
    await prisma.bot.update({
      where: { id: bot.id },
      data: { utmifyApiToken: null, utmifyEnabled: false }
    });
    res.status(204).send();
  }));

  router.post("/bots/:id/utmify/test", route(async (req, res) => {
    const bot = await prisma.bot.findUnique({ where: { id: routeParam(req, "id") } });
    if (!bot) throw new HttpError(404, "Bot not found");

    const testOrderId = `test_${Date.now()}`;
    let sent = true;
    let error: string | undefined;

    try {
      sendUtmifyOrder({
        botId: bot.id,
        orderId: testOrderId,
        status: "paid",
        customerName: "Test User",
        customerEmail: "test@botflix.user",
        productName: "Test Product",
        priceInCents: 100,
        utmParams: {
          utm_source: "test",
          utm_campaign: "test_campaign",
          utm_medium: "test_medium"
        },
        totalPaidCents: 100,
        createdAt: new Date(),
        apiToken: bot.utmifyApiToken ?? "",
        enabled: bot.utmifyEnabled
      });
    } catch (err) {
      sent = false;
      error = err instanceof Error ? err.message : String(err);
    }

    res.json(serializeJson({ sent, orderId: testOrderId, error }));
  }));

  return router;
}
