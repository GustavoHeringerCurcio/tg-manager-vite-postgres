import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { adminAuth } from "../src/middleware/auth.js";

describe("adminAuth", () => {
  it("rejects missing token and accepts valid bearer token", async () => {
    const app = express();
    app.get("/protected", adminAuth("secret"), (_req, res) => res.json({ ok: true }));
    await request(app).get("/protected").expect(401);
    const response = await request(app).get("/protected").set("Authorization", "Bearer secret").expect(200);
    expect(response.body).toEqual({ ok: true });
  });
});
