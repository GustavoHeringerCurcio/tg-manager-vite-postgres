import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { serializeJson } from "../utils/serialize.js";
import { getGlobalConfig, updateGlobalConfig } from "../bot/globalConfig.js";

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function route(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

export function adminRouter(): Router {
  const router = Router();

  router.get("/admin/config", route(async (_req, res) => {
    const config = getGlobalConfig();
    res.json(serializeJson(config));
  }));

  router.put("/admin/config", route(async (req, res) => {
    const config = await updateGlobalConfig(req.body);
    res.json(serializeJson(config));
  }));

  return router;
}
