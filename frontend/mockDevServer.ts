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

function seedBots(): void {
  const now = new Date();
  const ts = (offsetMs = 0): string => new Date(now.getTime() - offsetMs).toISOString();
  const sid = (prefix: string, i: number): string => `${prefix}_step_${i}`;
  const bid = (prefix: string, i: number): string => `${prefix}_btn_${i}`;

  const demo1: MockBot = {
    id: "bot_demo_001",
    name: "Demo Bot (Active)",
    token: "mock-encrypted-token",
    messageFlow: [
      {
        id: sid("demo1", 1),
        title: "Welcome",
        type: "TEXT",
        text: "Welcome to Botflix! \n\nThis is a demo of what your bot's message flow can look like. Configure your own steps in the editor.",
        mediaUrls: [],
        delayMs: 0,
        buttons: [
          { id: bid("demo1", 1), label: "Learn More", color: "BLUE", action: "OPEN_URL", url: "https://opencode.ai" },
          { id: bid("demo1", 2), label: "Unlock Access \u2014 R$29,90", color: "GREEN", action: "LIVEPIX_PAYMENT" },
        ],
      },
      {
        id: sid("demo1", 2),
        title: "Video Content",
        type: "VIDEO",
        text: "Here's a quick overview of our platform.",
        mediaUrls: ["https://www.w3schools.com/html/mov_bbb.mp4"],
        delayMs: 1500,
        buttons: [
          { id: bid("demo1", 3), label: "Get Started", color: "GREEN", action: "LIVEPIX_PAYMENT" },
        ],
      },
      {
        id: sid("demo1", 3),
        title: "Final Reminder",
        type: "AUDIO",
        text: "Don't miss out on this limited offer!",
        mediaUrls: [],
        delayMs: 2000,
        buttons: [
          { id: bid("demo1", 4), label: "Join Now", color: "RED", action: "LIVEPIX_PAYMENT" },
          { id: bid("demo1", 5), label: "Visit Site", color: "BLUE", action: "OPEN_URL", url: "https://opencode.ai" },
        ],
      },
    ],
    remarketing: {
      enabled: true,
      intervalMs: 86_400_000,
      initialDelayMs: 3_600_000,
      maxSends: 3,
      messages: [
        {
          id: sid("demo1_rm", 1),
          title: "Follow-up",
          type: "TEXT",
          text: "Hey! We noticed you didn't complete your checkout. Still interested? Click below to continue.",
          mediaUrls: [],
          delayMs: 0,
          buttons: [
            { id: bid("demo1_rm", 1), label: "Complete Purchase", color: "GREEN", action: "LIVEPIX_PAYMENT" },
          ],
        },
      ],
    },
    checkoutAmount: 29.9,
    status: "ACTIVE",
    createdAt: ts(86_400_000),
    updatedAt: ts(3_600_000),
  };

  const demo2: MockBot = {
    id: "bot_demo_002",
    name: "Test Bot (Inactive)",
    token: "mock-encrypted-token",
    messageFlow: [
      {
        id: sid("demo2", 1),
        title: "Intro",
        type: "TEXT",
        text: "This is a simple bot with a basic message flow. Edit it or activate it to test different configurations.",
        mediaUrls: [],
        delayMs: 0,
        buttons: [
          { id: bid("demo2", 1), label: "Open Website", color: "BLUE", action: "OPEN_URL", url: "https://opencode.ai" },
        ],
      },
    ],
    remarketing: {
      enabled: false,
      intervalMs: 0,
      initialDelayMs: 0,
      maxSends: 0,
      messages: [],
    },
    checkoutAmount: 9.9,
    status: "INACTIVE",
    createdAt: ts(172_800_000),
    updatedAt: ts(86_400_000),
  };

  bots.set(demo1.id, demo1);
  bots.set(demo2.id, demo2);
}

seedBots();

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
