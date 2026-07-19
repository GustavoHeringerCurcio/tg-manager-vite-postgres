import type { IncomingMessage, ServerResponse } from "http";

interface MockBot {
  id: string;
  name: string;
  token: string;
  messageFlow: unknown;
  remarketing: unknown;
  checkoutAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const bots = new Map<string, MockBot>();

function generateId(): string {
  return `bot_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function sanitizeBot(bot: MockBot): Omit<MockBot, "token"> {
  const { token: _, ...safe } = bot;
  return safe;
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer | string) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function noContent(res: ServerResponse): void {
  res.writeHead(204);
  res.end();
}

function extractBotId(path: string): string | null {
  const match = path.match(/^\/api\/bots\/([^/]+)/);
  return match ? match[1] : null;
}

function notFound(res: ServerResponse): void {
  json(res, { error: "Bot not found" }, 404);
}

export async function mockRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const rawUrl = req.url ?? "/";
  const url = new URL(rawUrl, "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (!path.startsWith("/api/")) return false;

  // GET /api/bots
  if (method === "GET" && path === "/api/bots") {
    json(res, Array.from(bots.values()).map(sanitizeBot));
    return true;
  }

  // POST /api/bots
  if (method === "POST" && path === "/api/bots") {
    const body = (await parseBody(req)) as Record<string, unknown>;
    const id = generateId();
    const now = new Date().toISOString();
    const bot: MockBot = {
      id,
      name: (body.name as string) ?? "",
      token: "mock-encrypted-token",
      messageFlow: body.messageFlow ?? [],
      remarketing: body.remarketing ?? {},
      checkoutAmount: (body.checkoutAmount as number) ?? 29.9,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    bots.set(id, bot);
    json(res, sanitizeBot(bot), 201);
    return true;
  }

  const botId = extractBotId(path);
  if (!botId) return false;

  const bot = bots.get(botId);

  // GET /api/bots/:id
  if (method === "GET" && path === `/api/bots/${botId}`) {
    if (!bot) { notFound(res); return true; }
    json(res, sanitizeBot(bot));
    return true;
  }

  // PUT /api/bots/:id
  if (method === "PUT" && path === `/api/bots/${botId}`) {
    if (!bot) { notFound(res); return true; }
    const body = (await parseBody(req)) as Record<string, unknown>;
    bot.name = (body.name as string) ?? bot.name;
    bot.messageFlow = body.messageFlow ?? bot.messageFlow;
    bot.remarketing = body.remarketing ?? bot.remarketing;
    bot.checkoutAmount = (body.checkoutAmount as number) ?? bot.checkoutAmount;
    bot.updatedAt = new Date().toISOString();
    json(res, sanitizeBot(bot));
    return true;
  }

  // PATCH /api/bots/:id/status
  if (method === "PATCH" && path === `/api/bots/${botId}/status`) {
    if (!bot) { notFound(res); return true; }
    const body = (await parseBody(req)) as Record<string, unknown>;
    bot.status = (body.status as string) ?? bot.status;
    bot.updatedAt = new Date().toISOString();
    json(res, sanitizeBot(bot));
    return true;
  }

  // DELETE /api/bots/:id
  if (method === "DELETE" && path === `/api/bots/${botId}`) {
    if (!bot) { notFound(res); return true; }
    bots.delete(botId);
    noContent(res);
    return true;
  }

  // GET /api/bots/:id/transactions
  if (method === "GET" && path === `/api/bots/${botId}/transactions`) {
    if (!bot) { notFound(res); return true; }
    json(res, { items: [], total: 0, page: 1, pageSize: 10 });
    return true;
  }

  // GET /api/bots/:id/interactions
  if (method === "GET" && path === `/api/bots/${botId}/interactions`) {
    if (!bot) { notFound(res); return true; }
    json(res, { items: [], total: 0, page: 1, pageSize: 10 });
    return true;
  }

  // GET /api/bots/:id/interactions/stats
  if (method === "GET" && path === `/api/bots/${botId}/interactions/stats`) {
    if (!bot) { notFound(res); return true; }
    json(res, {
      totalInteractions: 0,
      totalUsers: 0,
      checkoutClicks: 0,
      messageCount: 0,
      callbackCount: 0,
      dailyActiveUsers: 0,
    });
    return true;
  }

  return false;
}
