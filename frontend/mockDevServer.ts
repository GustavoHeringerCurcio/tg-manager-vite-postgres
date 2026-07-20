import type { IncomingMessage, ServerResponse } from "http";

interface MockBot {
  id: string;
  name: string;
  token: string;
  messageFlow: unknown;
  remarketing: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MockUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface MockTransaction {
  id: string;
  botId: string;
  amount: number;
  status: string;
  paymentMethod: string;
  pixCode: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  userId: string;
}

interface MockInteraction {
  id: string;
  botId: string;
  type: string;
  direction: string;
  content: string | null;
  payload: object | null;
  createdAt: string;
  userId: string | null;
}

const bots = new Map<string, MockBot>();
const transactions = new Map<string, MockTransaction[]>();
const interactions = new Map<string, MockInteraction[]>();

const mockUsers: MockUser[] = [
  { id: "user_001", telegramId: "123456789", username: "johndoe", firstName: "John", lastName: "Doe" },
  { id: "user_002", telegramId: "987654321", username: "janedoe", firstName: "Jane", lastName: "Doe" },
  { id: "user_003", telegramId: "555111222", username: null, firstName: "Bob", lastName: "Smith" },
  { id: "user_004", telegramId: "444333111", username: "alice_w", firstName: "Alice", lastName: "Williams" },
  { id: "user_005", telegramId: "888777666", username: null, firstName: "Carlos", lastName: null },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
  return d;
}

function seedTransactions(botId: string, checkoutAmount: number, count: number): void {
  const statuses = ["completed", "completed", "completed", "pending", "failed", "refunded"];
  const payments: { method: string; pixCode?: string; checkoutUrl?: string }[] = [
    { method: "PIX", pixCode: "00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540510.005802BR5909Botflix6009Sao Paulo62070503***6304A1B2" },
    { method: "PIX", pixCode: "00020126360014br.gov.bcb.pix0114+551199999999952040000530398654059.905802BR5913Fulano de Tal6008Brasilia62070503***6304C3D4" },
    { method: "CREDIT_CARD", checkoutUrl: "https://checkout.livepix.gg/pay/test_txn_abc123" },
    { method: "PIX", pixCode: "00020126450014br.gov.bcb.pix0123payment-ref-xyz-789-456520400005303986540529.905802BR5925Maria Silva6009Sao Paulo62070503***6304E5F6", checkoutUrl: "https://checkout.livepix.gg/pay/test_txn_def456" },
    { method: "CREDIT_CARD", checkoutUrl: "https://checkout.livepix.gg/pay/test_txn_ghi789" },
  ];

  const txs: MockTransaction[] = [];
  for (let i = 0; i < count; i++) {
    const user = pickRandom(mockUsers);
    const pay = pickRandom(payments);
    txs.push({
      id: `txn_${botId}_${i + 1}`,
      botId,
      amount: checkoutAmount,
      status: statuses[i % statuses.length],
      paymentMethod: pay.method,
      pixCode: pay.pixCode ?? null,
      checkoutUrl: pay.checkoutUrl ?? null,
      createdAt: randomDate(7).toISOString(),
      userId: user.id,
    });
  }
  transactions.set(botId, txs);
}

function seedInteractions(botId: string, count: number): void {
  const types = ["message", "message", "message", "callback_query", "callback_query"];
  const inMessages = [
    "/start", "Hi", "Hello", "I want to know more", "What is this?",
    "How much does it cost?", "Can I get a discount?", "Yes",
    "I'm interested", "Let me think about it", "/help",
  ];
  const outMessages = [
    "Welcome to Botflix! 🎬",
    "Here is your exclusive content link: https://example.com/vip",
    "To unlock full access, complete your payment below.",
    "Your payment is being processed...",
    "Access granted! Enjoy the content.",
    "Reminder: your trial expires in 24 hours.",
  ];
  const callbackData = [
    "purchase_29.90", "learn_more", "open_url_https://opencode.ai",
    "remarketing_opt_in", "remarketing_opt_out", "checkout_click",
  ];

  const ints: MockInteraction[] = [];
  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const isMessage = type === "message";
    const direction = isMessage && i % 3 === 0 ? "IN" : isMessage ? "OUT" : "IN";
    const content = direction === "IN"
      ? pickRandom(inMessages)
      : pickRandom(outMessages);
    const hasPayload = i % 4 === 0;

    ints.push({
      id: `int_${botId}_${i + 1}`,
      botId,
      type,
      direction,
      content,
      payload: hasPayload
        ? (direction === "IN"
            ? { callback_data: pickRandom(callbackData), from: { id: pickRandom(mockUsers).telegramId, is_bot: false, first_name: pickRandom(mockUsers).firstName } }
            : { message_id: Math.floor(Math.random() * 10000), chat: { id: pickRandom(mockUsers).telegramId }, text: content })
        : null,
      createdAt: randomDate(3).toISOString(),
      userId: i % 7 === 0 ? null : pickRandom(mockUsers).id,
    });
  }
  interactions.set(botId, ints);
}

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
      discountOffer: { enabled: false, tiers: [] },
    },
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
      discountOffer: { enabled: false, tiers: [] },
    },
    status: "INACTIVE",
    createdAt: ts(172_800_000),
    updatedAt: ts(86_400_000),
  };

  bots.set(demo1.id, demo1);
  bots.set(demo2.id, demo2);

  seedTransactions(demo1.id, 29.9, 12);
  seedTransactions(demo2.id, 9.9, 4);
  seedInteractions(demo1.id, 18);
  seedInteractions(demo2.id, 10);
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
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10);
    const all = transactions.get(botId) ?? [];
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize).map((txn) => {
      const user = mockUsers.find((u) => u.id === txn.userId)!;
      return { id: txn.id, amount: txn.amount, status: txn.status, paymentMethod: txn.paymentMethod, pixCode: txn.pixCode, checkoutUrl: txn.checkoutUrl, createdAt: txn.createdAt, user };
    });
    json(res, { items, total: all.length, page, pageSize });
    return true;
  }

  // GET /api/bots/:id/interactions
  if (method === "GET" && path === `/api/bots/${botId}/interactions`) {
    if (!bot) { notFound(res); return true; }
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "10", 10);
    const typeFilter = url.searchParams.get("type") ?? "";
    const userIdFilter = url.searchParams.get("userId") ?? "";
    const fromDate = url.searchParams.get("from") ?? "";
    const toDate = url.searchParams.get("to") ?? "";

    let all = interactions.get(botId) ?? [];
    if (typeFilter && typeFilter !== "all") {
      all = all.filter((i) => i.type === typeFilter);
    }
    if (userIdFilter) {
      all = all.filter((i) => i.userId === userIdFilter);
    }
    if (fromDate) {
      all = all.filter((i) => i.createdAt >= fromDate);
    }
    if (toDate) {
      const toEnd = toDate + "T23:59:59.999Z";
      all = all.filter((i) => i.createdAt <= toEnd);
    }

    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize).map((int) => ({
      id: int.id,
      type: int.type,
      direction: int.direction,
      content: int.content,
      payload: int.payload ?? undefined,
      createdAt: int.createdAt,
      user: int.userId ? mockUsers.find((u) => u.id === int.userId) ?? null : null,
    }));
    json(res, { items, total: all.length, page, pageSize });
    return true;
  }

  // GET /api/bots/:id/interactions/stats
  if (method === "GET" && path === `/api/bots/${botId}/interactions/stats`) {
    if (!bot) { notFound(res); return true; }
    const all = interactions.get(botId) ?? [];
    const userIds = new Set(all.filter((i) => i.userId).map((i) => i.userId!));
    const today = new Date().toISOString().slice(0, 10);
    const dailyActive = new Set(
      all.filter((i) => i.userId && i.createdAt.slice(0, 10) === today).map((i) => i.userId!)
    ).size;
    json(res, {
      totalInteractions: all.length,
      totalUsers: userIds.size,
      checkoutClicks: all.filter((i) => i.type === "callback_query" && i.content?.includes("checkout")).length,
      messageCount: all.filter((i) => i.type === "message").length,
      callbackCount: all.filter((i) => i.type === "callback_query").length,
      dailyActiveUsers: dailyActive,
    });
    return true;
  }

  return false;
}
