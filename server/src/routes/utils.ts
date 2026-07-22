import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response as ExpressResponse } from "express";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../services/prisma.js";

type AsyncRoute = (req: Request, res: ExpressResponse, next: NextFunction) => Promise<void>;

function route(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

const uploadDir = path.join(os.tmpdir(), "botflix-uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      cb(null, safeName);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

export function utilsRouter(): Router {
  const router = Router();

  router.post("/utils/file-id", route(async (req, res) => {
    try {
      const isMultipart = req.is("multipart/form-data");

      if (isMultipart) {
        upload.single("file")(req, res, async (uploadErr) => {
          if (uploadErr) {
            const message = uploadErr instanceof Error ? uploadErr.message : "upload_error";
            console.error(`[utils:file-id] upload error: ${message}`);
            res.status(400).json({ error: "upload_error", message });
            return;
          }

          if (!req.file) {
            res.status(400).json({ error: "No file provided" });
            return;
          }

          const botId = typeof req.body?.botId === "string" ? req.body.botId.trim() : "";
          const chatId = typeof req.body?.chatId === "string" ? req.body.chatId.trim() : "";

          if (!botId || !chatId) {
            cleanupFile(req.file.path);
            res.status(400).json({ error: "Missing botId or chatId" });
            return;
          }

          const bot = await prisma.bot.findUnique({
            where: { id: botId },
            select: { id: true, token: true }
          });

          if (!bot) {
            cleanupFile(req.file.path);
            res.status(404).json({ error: "Bot not found" });
            return;
          }

          try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const blob = new Blob([fileBuffer], { type: req.file.mimetype || "application/octet-stream" });
            const formData = new FormData();
            formData.append("chat_id", chatId);
            formData.append("document", blob, req.file.originalname);

            const tgResp = await fetch(`https://api.telegram.org/bot${bot.token}/sendDocument`, {
              method: "POST",
              body: formData
            });

            const text = await tgResp.text().catch(() => "");
            if (!tgResp.ok) {
              console.error(`[utils:file-id] Telegram API error ${tgResp.status}: ${text}`);
              res.status(502).json({ error: "telegram_error", status: tgResp.status });
              return;
            }

            const payload = JSON.parse(text);
            const result = extractFileIds(payload?.result);

            if (!result.fileId) {
              console.error("[utils:file-id] Could not extract file_id from Telegram result");
              res.status(502).json({ error: "file_id_not_found" });
              return;
            }

            res.json({ ok: true, fileId: result.fileId, fileUniqueId: result.fileUniqueId });
          } finally {
            cleanupFile(req.file.path);
          }
        });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const botId = typeof body.botId === "string" ? body.botId.trim() : "";
      const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
      const url = typeof body.url === "string" ? body.url.trim() : "";

      if (!botId || !chatId || !url) {
        res.status(400).json({ error: "Missing botId, chatId or url" });
        return;
      }

      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        select: { id: true, token: true }
      });

      if (!bot) {
        res.status(404).json({ error: "Bot not found" });
        return;
      }

      let tgResp: Response;
      try {
        tgResp = await fetch(`https://api.telegram.org/bot${bot.token}/sendDocument`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, document: url })
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[utils:file-id] Telegram request failed: ${message}`);
        res.status(502).json({ error: "telegram_request_failed" });
        return;
      }

      const text = await tgResp.text().catch(() => "");
      if (!tgResp.ok) {
        console.error(`[utils:file-id] Telegram API error ${tgResp.status}: ${text}`);
        res.status(502).json({ error: "telegram_error", status: tgResp.status });
        return;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        console.error("[utils:file-id] Invalid JSON from Telegram");
        res.status(502).json({ error: "invalid_telegram_response" });
        return;
      }

      const result = extractFileIds(payload?.result as Record<string, unknown> | undefined);

      if (!result.fileId) {
        console.error("[utils:file-id] Could not extract file_id from Telegram result");
        res.status(502).json({ error: "file_id_not_found" });
        return;
      }

      res.json({ ok: true, fileId: result.fileId, fileUniqueId: result.fileUniqueId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unexpected error";
      console.error(`[utils:file-id] ${message}`);
      res.status(500).json({ error: message });
    }
  }));

  return router;
}

function extractFileIds(result: Record<string, unknown> | undefined): { fileId?: string; fileUniqueId?: string } {
  if (!result || typeof result !== "object") return {};

  const doc = result.document as Record<string, unknown> | undefined;
  const audio = result.audio as Record<string, unknown> | undefined;
  const voice = result.voice as Record<string, unknown> | undefined;
  const video = result.video as Record<string, unknown> | undefined;
  const photo = result.photo as Array<Record<string, unknown>> | undefined;

  const fileId = (doc?.file_id ?? audio?.file_id ?? voice?.file_id ?? video?.file_id
    ?? (Array.isArray(photo) && photo.length > 0 ? photo[photo.length - 1]?.file_id : undefined)) as string | undefined;

  const fileUniqueId = (doc?.file_unique_id ?? audio?.file_unique_id ?? voice?.file_unique_id ?? video?.file_unique_id
    ?? (Array.isArray(photo) && photo.length > 0 ? photo[photo.length - 1]?.file_unique_id : undefined)) as string | undefined;

  return { fileId, fileUniqueId };
}

function cleanupFile(filePath: string): void {
  fs.unlink(filePath, (err) => {
    if (err) console.error(`[utils:file-id] cleanup error: ${err.message}`);
  });
}
