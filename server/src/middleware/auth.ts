import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function adminAuth(adminPassword: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || !safeEqual(token, adminPassword)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
