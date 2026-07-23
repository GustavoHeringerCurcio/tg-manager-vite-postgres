import type { Request, Response } from "express";
import { getBotManager } from "../services/botRegistry.js";

export function webhookDispatcher(req: Request, res: Response): void {
  const botId = String(req.params.botId);
  const manager = getBotManager(botId);
  if (!manager) {
    console.warn(`[webhook] Unknown bot webhook attempt: ${botId}`);
    res.status(404).json({ error: "Bot not found" });
    return;
  }

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
      const message = error instanceof Error ? error.message : "webhook background error";
      console.error(`[webhook:${botId}] ${message}`);
    }
  });
}
