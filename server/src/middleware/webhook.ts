import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";
import { getBotManager } from "../services/botRegistry.js";
import { webhooksTotal } from "../utils/metrics.js";

export function webhookDispatcher(req: Request, res: Response): void {
  const botId = String(req.params.botId);
  const manager = getBotManager(botId);
  if (!manager) {
    webhooksTotal.inc({ bot_id: botId, status: "not_found" });
    logger.warn(`[webhook] Unknown bot webhook attempt: ${botId}`);
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  webhooksTotal.inc({ bot_id: botId, status: "ok" });
  res.status(200).json({ ok: true });

  setImmediate(() => {
    try {
      const mockRes: Partial<Response> = {
        end: () => mockRes as Response,
        writeHead: () => mockRes as Response,
        setHeader: () => mockRes as Response,
        getHeader: () => undefined,
        removeHeader: () => {},
        headersSent: true,
        statusCode: 200,
      };
      manager.webhookMiddleware()(req, mockRes as Response, () => {});
    } catch (error) {
      webhooksTotal.inc({ bot_id: botId, status: "error" });
      const message = error instanceof Error ? error.message : "webhook background error";
      logger.error(`[webhook:${botId}] ${message}`);
    }
  });
}
