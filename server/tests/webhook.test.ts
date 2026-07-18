import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { webhookDispatcher } from "../src/middleware/webhook.js";

describe("webhookDispatcher", () => {
  it("returns 404 for missing bot managers", async () => {
    const app = express();
    app.post("/webhook/:botId", webhookDispatcher);
    const response = await request(app).post("/webhook/missing").send({}).expect(404);
    expect(response.body).toEqual({ error: "Bot not found" });
  });
});
