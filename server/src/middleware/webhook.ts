import type { NextFunction, Request, Response } from "express";
import { getBotManager } from "../services/botRegistry.js";

export function webhookDispatcher(req: Request, res: Response, next: NextFunction): void {
  const botId = String(req.params.botId);
  const manager = getBotManager(botId);
  if (!manager) {
    console.warn(`[webhook] Unknown bot webhook attempt: ${botId}`);
    res.status(404).json({ error: "Bot not found" });
    return;
  }
  manager.webhookMiddleware()(req, res, next);
}
