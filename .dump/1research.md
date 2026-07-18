# Botflix v2 — Research & Architecture Document

> Multi-bot Telegram payment management system — React (Vite), Node.js/Express,
> PostgreSQL, Prisma ORM, Docker single-container, Telegraf webhooks, LivePix PIX
> integration.

---

## 1. Project Overview

A single-admin system for managing **multiple Telegram bots** that act as
payment gateways using **LivePix PIX "Copia e Cola" (QR Code)**. All content
(messages, buttons, payments) is configurable via a React admin dashboard.

**Scale target:** 10,000+ Telegram end-user interactions per day across all bot
instances.

**Key dependencies:**
- [Telegraf](https://telegraf.js.org/) v4 — Telegram Bot framework (webhook
  mode)
- [Express](https://expressjs.com/) — API server + static file serving
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — Admin dashboard
- [Tailwind CSS](https://tailwindcss.com/) — Dashboard styling
- [Prisma ORM](https://www.prisma.io/) — Database schema, migrations, queries
- [PostgreSQL](https://www.postgresql.org/) — Relational database
- [Docker](https://www.docker.com/) — Containerized deployment (single container)

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Docker Container (single)                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Express Server (:3000)                                  │ │
│  │                                                         │ │
│  │  /api/*          → REST API (admin CRUD, health)        │ │
│  │  /webhook/:botId → Telegram webhook dispatcher          │ │
│  │  /*              → Static files (React SPA fallback)    │ │
│  │                                                         │ │
│  │  Bot Manager (in-memory Map)                            │ │
│  │  ├─ Bot 1 → Telegraf instance + handlers                │ │
│  │  ├─ Bot 2 → Telegraf instance + handlers                │ │
│  │  └─ Bot N → Telegraf instance + handlers                │ │
│  │                                                         │ │
│  │  LivePix Service                                        │ │
│  │  ├─ Official API (create payment)                       │ │
│  │  └─ Stealth API (extract PIX code)                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ PostgreSQL 16                                           │ │
│  │  ├─ bots          (tenant config)                       │ │
│  │  ├─ users         (per-bot Telegram users)              │ │
│  │  ├─ transactions  (payment events)                      │ │
│  │  └─ interactions  (every message & button click)        │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

                    Telegram Servers
                    ┌──────────────┐
                    │ Bot 1 updates │──→ POST /webhook/bot1
                    │ Bot 2 updates │──→ POST /webhook/bot2
                    │ Bot N updates │──→ POST /webhook/botN
                    └──────────────┘
```

- **Single container** approach: The Express server hosts API routes, Telegram
  webhook callbacks, and the compiled React frontend.
- **Full interaction logging**: Every message and button click is logged to the
  `interactions` table for monitoring and debugging (see Section 8).
- **Immediate webhook acknowledgment**: `200 OK` is returned before bot logic
  executes, preventing Telegram retry loops.

---

## 3. Tech Stack Matrix

| Layer | Technology | Rationale |
|---|---|---|
| Bot framework | Telegraf v4 | Best-in-class webhook support, middleware composability |
| HTTP server | Express 4 | Serves API + webhooks + static frontend |
| Frontend | React 18 + Vite 5 | Fast HMR in dev, optimized static build for prod |
| CSS | Tailwind CSS 3 | Utility-first, small production bundle |
| Language | JavaScript (no TS) | Per spec — simpler build pipeline |
| ORM | Prisma | Type-safe queries, declarative schema, migration tooling |
| Database | PostgreSQL 16 | ACID, JSON support, robust for financial data |
| Container | Docker (multi-stage) | Single deployable artifact with embedded frontend |
| Orchestration | Docker Compose | App + DB + one-shot migration runner |
| Package manager | pnpm | Disk-efficient, deterministic lockfile |

---

## 4. Docker & Deployment

### 4.1 Multi-Stage Dockerfile

**Stage 1 — Frontend builder** (`node:20-alpine`):
- Copies `frontend/package.json` + `pnpm-lock.yaml`
- Runs `pnpm install --frozen-lockfile` (all deps including dev)
- Copies frontend source + Vite config
- Runs `pnpm run build` → outputs `dist/`

**Stage 2 — Production runtime** (`node:20-alpine`, non-root user):
- Copies `server/package.json` + `pnpm-lock.yaml`
- Runs `pnpm install --frozen-lockfile --prod` (prod deps only)
- Copies `dist/` from Stage 1 → `public/`
- Copies server source + Prisma schema + migrations
- Runs `npx prisma generate` → generates Prisma Client
- `EXPOSE 3000`, `CMD ["node", "src/server.js"]`
- Non-root user (`appuser`, UID 1001)

### 4.2 docker-compose.yml

Three services:

| Service | Role | Depends On |
|---|---|---|
| `app` | Express (API + webhooks + static) | `db` (healthy) |
| `db` | PostgreSQL 16 Alpine | — |
| `db-migrate` | One-shot `prisma migrate deploy` | `db` (healthy) |

Key details:
- `depends_on: db: condition: service_healthy` — prevents app starting before
  PostgreSQL accepts connections
- `db-migrate` runs `prisma migrate deploy` and exits (not restarted)
- Named volume `pgdata` preserves database data across `docker-compose down`
- PostgreSQL health check: `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}`
- App health check: `GET /api/health` (validates DB connection too)

### 4.3 Environment Variables

```
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public
POSTGRES_USER=botflix
POSTGRES_PASSWORD=<secret>
POSTGRES_DB=botflix
APP_PORT=3000
NODE_ENV=production
DOMAIN=botflix.example.com
MAX_PIX_GENERATIONS=5
INTERACTION_RETENTION_DAYS=90
LOG_PAYLOADS=false
LIVEPIX_CLIENT_ID=<secret>
LIVEPIX_CLIENT_SECRET=<secret>
```

- `.env.example` committed to Git (template only)
- `.env` gitignored (real secrets)
- Docker Compose interpolation: `${VAR_NAME}` pulls from shell or `.env` file
- Prisma reads `DATABASE_URL` via `env("DATABASE_URL")` in schema

### 4.4 Startup Flow

```
docker-compose up
  │
  ├─ 1. db starts → pg_isready health check passes
  │
  ├─ 2. db-migrate runs prisma migrate deploy → exits 0
  │
  └─ 3. app starts → loads bots from DB → sets webhooks → listens :3000
```

---

## 5. Prisma Schema & Database

### 5.1 Enum Definitions

```prisma
/// Closed set of bot lifecycle states. Suitable for PostgreSQL enum.
enum BotStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

/// Closed set of payment methods. Rarely changes.
enum PaymentMethod {
  PIX
  CREDIT_CARD
}
```

### 5.2 Models

```prisma
model Bot {
  id                 String    @id @default(cuid())
  name               String
  token              String              // Encrypted Telegram bot token
  welcomeVideoUrl    String?             // file_id or URL
  welcomeText        String?             // Welcome message
  checkoutButtonText String    @default("Pagar agora")
  supportButtonText  String    @default("Suporte")
  supportUrl         String?             // URL for support button
  status             BotStatus @default(ACTIVE)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users        User[]
  transactions Transaction[]

  @@map("bots")
}

model User {
  id         String  @id @default(cuid())
  botId      String  // FK → Bot
  telegramId BigInt  // Telegram user ID (up to 64-bit)

  username  String?
  firstName String?
  lastName  String?

  pixGenerations  Int       @default(0)
  lastInteraction DateTime? // null until first bot interaction

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  bot          Bot           @relation(fields: [botId], references: [id], onDelete: Cascade)
  transactions Transaction[]

  @@unique([botId, telegramId]) // Same Telegram user can interact with multiple bots
  @@index([botId])
  @@map("users")
}

model Transaction {
  id     String @id @default(cuid())
  botId  String // FK → Bot (denormalized for efficient per-bot queries)
  userId String // FK → User

  amount Float         // Amount in BRL (e.g., 29.90)
  paymentMethod PaymentMethod

  // String, not enum — statuses evolve over time (PENDING, PAID, EXPIRED, etc.)
  status String @default("PENDING")

  pixCode     String?  // Raw PIX copia-e-cola code (EMV-QRCPS)
  checkoutUrl String?  // LivePix redirect URL (fallback)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  bot  Bot  @relation(fields: [botId],  references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([botId, status])
  @@index([botId, createdAt])
  @@index([userId])
  @@map("transactions")
}

model Interaction {
  id        String   @id @default(cuid())
  botId     String   // FK → Bot
  userId    String?  // FK → User (nullable — pre-/start messages may have no user yet)

  type      String   // "message" | "callback_query" | "inline_query"
  direction String   // "incoming" (user → bot) or "outgoing" (bot → user)
  content   String?  // Truncated text or callback_data (first 500 chars)
  payload   Json?    // Raw update or response metadata (toggleable via LOG_PAYLOADS env)

  createdAt DateTime @default(now())

  bot  Bot   @relation(fields: [botId],  references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([botId, createdAt])
  @@index([userId, createdAt])
  @@index([createdAt])
  @@map("interactions")
}
```

### 5.3 Key Schema Decisions

| Decision | Rationale |
|---|---|
| `cuid()` for PKs | Decentralized, URL-safe, no auto-increment collisions |
| `BigInt` for `telegramId` | Telegram IDs can exceed `Number.MAX_SAFE_INTEGER` |
| `String` for Transaction `status` | Statuses grow over time; enum migration is costly |
| `PaymentMethod` as `enum` | Truly closed set; new methods are rare, deliberate changes |
| `BotStatus` as `enum` | Finite, stable lifecycle states |
| `@@unique([botId, telegramId])` | Multi-tenant: same Telegram user per bot, but can exist across bots |
| Denormalized `botId` on Transaction | Efficient per-bot revenue queries without User join |
| `onDelete: Cascade` | Clean tenant teardown when a bot is removed |
| `Float` for `amount` | Acceptable for BRL with 2 decimals; upgrade to `Decimal(10,2)` for strict financial precision |
| `@updatedAt` on separate field | Tracks system updates; `lastInteraction` is user-facing, manually set |
| `token` stored encrypted | Encrypt at application layer before DB write; never log this field |
| `Interaction.payload` as `Json?` | Stores raw Telegram update/response for debugging; toggleable via `LOG_PAYLOADS=false` |
| `Interaction.userId` nullable with `onDelete: SetNull` | Pre-/start messages may arrive before User record exists; preserve log if user is deleted |
| `@@index([createdAt])` on Interaction | Enables efficient retention cleanup queries (`DELETE ... WHERE createdAt < NOW() - INTERVAL '90 days'`) |

### 5.4 Migrations Workflow

```
DEVELOPMENT:
  Edit schema.prisma → prisma migrate dev --name "description"
  → generates prisma/migrations/YYYYMMDDHHMMSS_name/migration.sql
  → commit the migration folder to Git

PRODUCTION:
  prisma migrate deploy
  → reads prisma/migrations/ against _prisma_migrations table
  → applies only unapplied migrations (idempotent)
```

---

## 6. Dynamic Webhook Routing & Security

### 6.1 Multi-Bot Webhook Dispatcher

Uses Express route parameter to dispatch to the correct bot instance:

```js
// Bot instances stored in memory
const botRegistry = new Map();

// Single catch-all webhook endpoint
app.post('/webhook/:botId', (req, res, next) => {
  const manager = botRegistry.get(req.params.botId);
  if (!manager) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  // Delegate to the bot's Telegraf webhook callback (handles filtering + secret token)
  manager.webhookMiddleware()(req, res, next);
});
```

Each bot is registered with:

```js
const path = `/webhook/${botId}`;
const secretToken = crypto.randomBytes(32).toString('hex');

// Register webhook URL with Telegram
await bot.telegram.setWebhook(`https://${domain}${path}`, {
  secret_token: secretToken,
  drop_pending_updates: true,
  allowed_updates: ['message', 'callback_query'],
});

// Get Express middleware that validates path + secret token header
const middleware = bot.webhookCallback(path, { secretToken });
```

### 6.2 Webhook Security Model

- **Path-based routing**: Each bot gets a unique URL `/webhook/{botId}`
- **Secret token**: Telegram sends `X-Telegram-Bot-Api-Secret-Token` header with
  each webhook call; Telegraf validates it via `safeCompare()`
- **Telegram IPs**: All webhook calls originate from Telegram's known IP ranges
  (optional additional filter available)

### 6.3 Immediate 200 OK (Async Processing)

Uses `Composer.fork()` to fire-and-forget bot logic, returning `200` to Telegram
immediately:

```js
const { Telegraf, Composer } = require('telegraf');

const bot = new Telegraf(token);

// Fork runs handler in background — response is NOT held for this middleware
bot.use(Composer.fork(async (ctx) => {
  ctx.telegram.webhookReply = false; // Force HTTP API mode for replies
  await processMessage(ctx);         // Heavy work runs asynchronously
}));
```

**How `Composer.fork()` works** (from Telegraf source):
- Wraps middleware in a background execution context
- Calls `next()` immediately without awaiting the wrapped handler
- The webhook response pipeline completes while the forked handler continues

**Alternative (more explicit):**

```js
app.post('/webhook/:botId', async (req, res) => {
  res.status(200).json({ ok: true }); // Acknowledge immediately

  setImmediate(async () => {
    try {
      await botManager.handleUpdate(req.body);
    } catch (err) {
      console.error('Update processing failed:', err);
    }
  });
});
```

---

## 7. Dynamic Message Handling & Humanized UX

### 7.1 /start Flow with Delays

When a user sends `/start` (first time or returning):

```
User sends /start
  │
  ├─ 1. INSTANT RESPONSE: ctx.reply("Olá! Bem-vindo ao BotFlix...")
  │    → Direct reply to the /start message
  │
  ├─ 2. NON-BLOCKING DELAY: await delay(1500)
  │    → Human feeling — bot is "typing" or "preparing"
  │    → Uses Promise + setTimeout, does NOT block webhook response
  │
  ├─ 3. SEND VIDEO: ctx.telegram.sendVideo(chatId, bot.welcomeVideoUrl, {
  │       caption: bot.welcomeText,
  │       reply_markup: { inline_keyboard: [...] }
  │    })
  │    → Uses file_id (cached, always available)
  │    → Inline keyboard built dynamically from bot config fields
  │
  └─ 4. UPSERT USER: prisma.user.upsert({
         where: { botId_telegramId: { botId, telegramId } },
         create: { botId, telegramId, username, firstName, lastName },
         update: { lastInteraction: new Date() }
       })
      → Update lastInteraction timestamp
```

### 7.2 Message Configuration

Messages and buttons are **not hardcoded** — they come from the `Bot` database
record:

| Field | Usage | Rendered As |
|---|---|---|
| `welcomeVideoUrl` | Video sent after greeting | `ctx.telegram.sendVideo(chatId, fileId)` |
| `welcomeText` | Caption on the video | `caption` parameter in `sendVideo` |
| `checkoutButtonText` | Primary inline keyboard button | `{ text, callback_data: 'checkout' }` |
| `supportButtonText` | Secondary inline keyboard button | `{ text, url: bot.supportUrl }` |

### 7.3 Media Handling

- **Videos and images**: Stored and sent via Telegram `file_id` (permanent,
  efficient, no hosting needed)
- **Audios**: Sent by local file path using `ctx.replyWithAudio({ source:
  path/to/file.mp3 })`
- File IDs are obtained by sending the media to the bot once via Telegram and
  capturing the `file_id` from the response

### 7.4 User Tracking

- `User.lastInteraction`: Updated on every bot interaction (text message,
  callback query)
- `User.pixGenerations`: Incremented atomically when a PIX payment is generated
- All messages and button clicks are logged to the `Interaction` table
  (see Section 8) for full conversation audit trails and debugging

---

## 8. Interaction Logging & Monitoring

### 8.1 Why Log Every Interaction

At 10,000 interactions/day, the `interactions` table grows by ~300K rows/month.
PostgreSQL handles this comfortably on modest hardware (a few GB of data per
year). The value for debugging, monitoring, and user support justifies the
storage:

- **Debugging**: Trace exactly what a user typed or clicked when reporting an
  issue
- **Monitoring**: Check that all bots are receiving and responding to messages
- **Audit trail**: See the full conversation flow for dispute resolution
- **Analytics**: Query button click-through rates, /start → payment conversion

### 8.2 Logging Implementation

Every incoming update and outgoing bot response is logged via a lightweight
helper:

```js
// services/logger.js
const LOG_PAYLOADS = process.env.LOG_PAYLOADS === 'true';

async function logInteraction({ botId, userId, type, direction, content, payload }) {
  // Fire-and-forget — don't block the bot's response
  prisma.interaction.create({
    data: {
      botId,
      userId,
      type,
      direction,
      content: typeof content === 'string'
        ? content.substring(0, 500) // Truncate to 500 chars
        : content,
      payload: LOG_PAYLOADS ? payload : undefined,
    },
  }).catch(err => console.error('[logger] Failed to write interaction:', err.message));
}

module.exports = { logInteraction };
```

**Incoming (user → bot):**

```js
// In bot handlers
bot.on('message', async (ctx) => {
  const userId = ctx.from?.id ? await findOrCreateUser(ctx) : null;

  logInteraction({
    botId: ctx.botInfo.id,   // or stored botId from manager
    userId,
    type: 'message',
    direction: 'incoming',
    content: ctx.message.text || '[non-text message]',
    payload: ctx.update,      // Raw Telegram update (only if LOG_PAYLOADS=true)
  });

  // ... handle message ...
});
```

**Outgoing (bot → user):**

```js
bot.on('callback_query', async (ctx) => {
  const userId = await findOrCreateUser(ctx);

  logInteraction({
    botId,
    userId,
    type: 'callback_query',
    direction: 'incoming',
    content: ctx.callbackQuery.data,  // e.g., "checkout", "support"
    payload: ctx.update,
  });

  await ctx.answerCbQuery();
  await ctx.reply('Processando...');

  // Log the bot's outgoing response
  logInteraction({
    botId,
    userId,
    type: 'message',
    direction: 'outgoing',
    content: 'Bot replied: "Processando..."',
  });
});
```

### 8.3 Data Retention

Without cleanup, the table will grow indefinitely. A retention policy is
essential:

- **Default**: Keep 90 days of interactions
- **Cleanup**: Run on server startup and optionally via cron

```js
// services/retention.js
const RETENTION_DAYS = parseInt(process.env.INTERACTION_RETENTION_DAYS || '90');

async function cleanupOldInteractions() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await prisma.interaction.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (result.count > 0) {
    console.log(`[retention] Deleted ${result.count} interactions older than ${RETENTION_DAYS} days`);
  }
}
```

- `INTERACTION_RETENTION_DAYS` env var controls the window (set to `0` or
  leave unset to disable cleanup entirely for long-term storage)
- Index on `createdAt` makes the `DELETE` query efficient (range scan)

### 8.4 Dashboard Integration

The admin dashboard includes an **Interactions** view per bot:

| UI Element | Description |
|---|---|
| Paginated table | Columns: Timestamp, User, Type, Direction, Content (truncated) |
| User filter | Dropdown or search to view a specific user's conversation |
| Type filter | Toggle: All / Messages / Callback Queries |
| Date range | Date picker to narrow the time window |
| Detail expand | Click a row to see the full `payload` (if logged) |

API routes:

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/bots/:id/interactions` | Paginated interactions for a bot (supports `?userId=`, `?type=`, `?from=`, `?to=`) |
| `GET` | `/api/bots/:id/interactions/stats` | Aggregated stats: daily active users, button click counts, message counts |

### 8.5 Performance Considerations

| Concern | Mitigation |
|---|---|
| Write throughput | `logInteraction()` is fire-and-forget (not awaited); 10K writes/day is ~1 write every 8 seconds |
| Insert latency | Single-row `INSERT` with indexed FKs — sub-millisecond on PostgreSQL |
| Read performance | Queries filter by `botId` + `createdAt` (indexed); paginate with `LIMIT`/`OFFSET` |
| Storage growth | ~300K rows/month ≈ 50-100 MB/month (depends on `payload` size) |
| No `payload` mode | With `LOG_PAYLOADS=false`, `content` is the only variable-length field (avg ~100 bytes/row) |

---

## 9. Stealth PIX Extraction (LivePix)

### 8.1 Architecture

LivePix uses a multi-domain setup. The official API only returns a checkout
`redirectUrl`. To get the raw PIX "copia e cola" code, an internal/stealth
endpoint is required.

Reference: `ADR/001-livepix-pix-code-fallback.md`

| Domain | Role | Auth |
|---|---|---|
| `oauth.livepix.gg` | OAuth2 token issuance | Client credentials |
| `api.livepix.gg/v2` | Official REST API (create payment) | Bearer token |
| `checkout.livepix.gg` | User-facing payment pages | Public |
| `webservice.livepix.gg` | **Stealth** PIX code extraction | WAF/Cloudflare bypass |

### 8.2 Complete Payment Flow

```
1. AUTHENTICATE
   POST https://oauth.livepix.gg/oauth2/token
   Body: grant_type=client_credentials&client_id=X&client_secret=Y&scope=payments:write
   → { access_token, expires_in: 3600 }

2. CREATE PAYMENT (Official API)
   POST https://api.livepix.gg/v2/payments
   Headers: Authorization: Bearer {token}
   Body: { amount: 2990, currency: "BRL", redirectUrl: "https://t.me/yourbot" }
   → { reference: "...", redirectUrl: "https://checkout.livepix.gg/61021c..." }

3. EXTRACT CHECKOUT ID
   checkoutId = redirectUrl.split('/').pop()
   → "61021c7bdabe5e001225b65b"

4. PROPAGATION DELAY
   await delay(1500)
   → Wait for LivePix backend to index the new payment

5. STEALTH PIX CODE EXTRACTION
   POST https://webservice.livepix.gg/checkout/payment/{checkoutId}
   Headers: Chrome/Windows browser headers (see 8.3)
   Body: { "method": "pix" }
   → { "code": "00020101021126360014br.gov.bcb.pix..." }
```

### 8.3 Browser Headers (Cloudflare Bypass)

The `webservice.livepix.gg` endpoint is protected by Cloudflare. The following
headers simulate a Chrome browser on Windows:

```js
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/json',
  'Origin': 'https://checkout.livepix.gg',
  'Referer': 'https://checkout.livepix.gg/',
};
```

### 8.4 Retry Loop (Exponential Backoff)

| Attempt | Delay (with ±50% jitter) |
|---|---|
| 1 | 0ms (first attempt, no delay) |
| 2 | ~800ms |
| 3 | ~1200ms |
| 4 | ~1800ms |
| 5 | ~2700ms |
| 6 | ~4050ms (capped at 5000ms) |

- Retries on: network errors (`ECONNRESET`, `ETIMEDOUT`), 5xx, 429,
  Cloudflare blocks (403 with HTML body)
- Does NOT retry on: 404 (invalid checkoutId), 4xx with JSON body (real app
  errors)
- Max 6 total attempts (~15 seconds before giving up)

### 8.5 Error Detection

```js
function isCloudflareBlock(response) {
  // Cloudflare block/challenge pages return HTML, not JSON
  const contentType = response.headers['content-type'] || '';
  if (!contentType.includes('application/json')) return true;
  // Additional heuristic: HTML body
  if (typeof response.data === 'string' && response.data.trimStart().startsWith('<!')) return true;
  return false;
}
```

### 8.6 Graceful Fallback

If stealth extraction fails for any reason (WAF block, Cloudflare challenge,
timeout, 500, network error), the error is caught silently and `pixCode` remains
`undefined`. The UX falls back to showing a `url` button linking to the checkout
page — the process never crashes.

```js
let pixCode = undefined;
try {
  pixCode = await fetchPixCodeViaWebservice(checkoutId);
} catch (err) {
  console.warn('[livepix] Could not extract PIX code:', err.message);
  // pixCode stays undefined → fallback to checkout URL
}
```

---

## 10. Rate Limiting & Graceful UX

### 10.1 PIX Generation Limiting

Before attempting stealth extraction, query the database:

```js
// Atomic check-and-increment
const user = await prisma.user.update({
  where: { id: userId },
  data: {
    pixGenerations: { increment: 1 },
    lastInteraction: new Date(),
  },
});

if (user.pixGenerations >= MAX_PIX_GENERATIONS) {
  // Skip stealth extraction entirely — go straight to checkout URL
  return { checkoutUrl, pixCode: undefined };
}
```

- `MAX_PIX_GENERATIONS` is an environment variable (default: 5)
- Counter persists across sessions in the `User.pixGenerations` column
- Prevents abuse and unnecessary stealth calls when user has generated many PIX
  codes

### 10.2 Presentation Logic

**When `pixCode` is available:**

```
💳 *Pagamento PIX - Plano Mensal*

Valor: *R$ 29,90*

*Código PIX (copia e cola):*
`00020101021126360014br.gov.bcb.pix...`

_Copie o código acima e cole no app do seu banco._
```

Rendered with:
- The PIX code inside a `<code>` (monospace) inline element
- A "Copiar código" inline button (callback copies to clipboard)

**When `pixCode` is NOT available (fallback):**

```
💳 *Pagamento PIX - Plano Mensal*

Valor: *R$ 29,90*

Clique no botão abaixo para fazer o pagamento.
```

Rendered with:
- A `url` button: `{ text: "🔗 Pagar via LivePix", url: checkoutUrl }`
- Telegraf's `Markup.inlineKeyboard()` handles the layout

### 10.3 Inline Keyboard Construction (Dynamic)

Buttons are built programmatically from bot config, not raw JSON:

```js
const keyboard = [];

// Checkout button (callback → payment flow)
keyboard.push([{
  text: bot.checkoutButtonText || 'Pagar agora',
  callback_data: 'checkout',
}]);

// Support button (url → external link)
if (bot.supportUrl) {
  keyboard.push([{
    text: bot.supportButtonText || 'Suporte',
    url: bot.supportUrl,
  }]);
}

await ctx.replyWithVideo(bot.welcomeVideoUrl, {
  caption: bot.welcomeText,
  reply_markup: { inline_keyboard: keyboard },
});
```

---

## 11. Admin Dashboard

### 11.1 Stack

- **React 18** (pure JavaScript — no TypeScript)
- **Vite 5** for build tooling
- **Tailwind CSS 3** for styling
- **Served by Express**: `express.static('public')` with SPA fallback
- **API Client**: `fetch()` or `axios` to call Express REST endpoints

### 11.2 Pages & Features

#### Bot Create Form (`/` or `/admin`)

Standard HTML form with discrete input fields (no raw JSON textareas):

| Field | Input Type | Description |
|---|---|---|
| Bot Name | `text` | Display name for the admin dashboard |
| Bot Token | `password` or `text` | Telegram Bot API token (from @BotFather) |
| Welcome Video URL | `text` | Telegram `file_id` of welcome video |
| Welcome Text | `textarea` | Welcome message caption |
| Checkout Button Text | `text` | Label on payment button (e.g., "Pagar agora") |
| Support Button Text | `text` | Label on support button (e.g., "Suporte") |
| Support URL | `text` | External support link |

Submit → `POST /api/bots` → creates Bot record + auto-registers webhook.

#### Bot List Table

Displays all bots from the database:

| Column | Data |
|---|---|
| Name | `bot.name` |
| Status | Inline toggle: ACTIVE ↔ INACTIVE |
| Actions | Edit, Delete |

- Toggling status to ACTIVE triggers `bot.telegram.setWebhook(url)` in the
  backend
- Toggling to INACTIVE triggers `bot.telegram.deleteWebhook()` + bot shutdown

### 11.3 API Routes (Express)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/bots` | List all bots |
| `POST` | `/api/bots` | Create new bot + auto-set webhook |
| `PUT` | `/api/bots/:id` | Update bot config |
| `PATCH` | `/api/bots/:id/status` | Toggle ACTIVE/INACTIVE |
| `DELETE` | `/api/bots/:id` | Delete bot + cascade users/transactions/interactions |
| `GET` | `/api/bots/:id/transactions` | Paginated transactions for a bot |
| `GET` | `/api/bots/:id/interactions` | Paginated interactions for a bot (`?userId=`, `?type=`, `?from=`, `?to=`) |
| `GET` | `/api/bots/:id/interactions/stats` | Aggregated interaction stats (daily active users, click counts) |
| `GET` | `/api/health` | Health check (DB + uptime) |

---

## 12. Dynamic Bot Lifecycle Management

### 12.1 Bot Manager Class

Each bot is wrapped in a `BotManager` that handles instantiation, webhook
registration, and shutdown:

```js
class BotManager {
  constructor(botId, token, config) {
    this.botId = botId;
    this.bot = new Telegraf(token);
    this.path = `/webhook/${botId}`;
    this.secretToken = crypto.randomBytes(32).toString('hex');

    // Fork middleware → immediate 200 + async processing
    this.bot.use(Composer.fork(async (ctx) => {
      ctx.telegram.webhookReply = false;
      await this.handleUpdate(ctx, config);
    }));

    this.bot.catch((err) => {
      console.error(`[${botId}] Error:`, err.message);
    });
  }

  async start(domain) {
    const url = `https://${domain}${this.path}`;
    await this.bot.telegram.setWebhook(url, {
      secret_token: this.secretToken,
      allowed_updates: ['message', 'callback_query'],
    });
  }

  async stop() {
    await this.bot.telegram.deleteWebhook();
    this.bot.stop();
  }

  webhookMiddleware() {
    return this.bot.webhookCallback(this.path, {
      secretToken: this.secretToken,
    });
  }
}
```

### 12.2 Lifecycle Events

| Event | Actions |
|---|---|
| **Bot created** via admin dashboard | 1. Prisma creates Bot record<br>2. `new BotManager()`<br>3. `manager.start(domain)` → `setWebhook()`<br>4. `botRegistry.set(botId, manager)` |
| **Bot status set to ACTIVE** | 1. Prisma updates status<br>2. If not already in registry: instantiate + `start()`<br>3. If already in registry: skip (already running) |
| **Bot status set to INACTIVE** | 1. Prisma updates status<br>2. `manager.stop()` → `deleteWebhook()` + `bot.stop()`<br>3. `botRegistry.delete(botId)` |
| **Server startup** | 1. Load all bots with `status === ACTIVE` from DB<br>2. Instantiate and register each<br>3. Set webhooks for all<br>4. Mount Express dispatcher |
| **Server shutdown** (`SIGINT`/`SIGTERM`) | 1. Unregister all bots from Telegram<br>2. `prisma.$disconnect()`<br>3. `process.exit(0)` |

### 12.3 Express Dispatcher (pre-registered)

```js
app.post('/webhook/:botId', (req, res, next) => {
  const manager = botRegistry.get(req.params.botId);
  if (!manager) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }
  manager.webhookMiddleware()(req, res, next);
});
```

The dispatcher is registered once at server startup. Adding/removing bots
only modifies the `botRegistry` Map — no Express route re-registration needed.

---

## 13. Security Considerations

| Concern | Mitigation |
|---|---|
| Bot token exposure | Encrypted at rest in database; never logged; `.env` gitignored |
| Webhook spoofing | `secret_token` validated via `X-Telegram-Bot-Api-Secret-Token` header (secure string compare) |
| Admin dashboard access | Single admin — authentication middleware (e.g., password or IP whitelist) on `/api/*` routes |
| Rate limiting | `pixGenerations` counter caps stealth PIX requests per user |
| SQL injection | Prisma parameterized queries eliminate injection vectors |
| Data retention | `INTERACTION_RETENTION_DAYS` auto-deletes old interactions; `LOG_PAYLOADS=false` skips raw payload storage |
| CORS | Restrict to admin dashboard origin |
| HTTPS | TLS termination at reverse proxy (Nginx/Caddy) or via `tlsOptions` in Telegraf webhook config |
| Secrets in environment | `.env` gitignored; Docker secrets or CI/CD injection for production |
| Container security | Non-root user in Dockerfile; minimal Alpine base image |

---

## 14. Project Structure

```
telegram-botflix-v2/
├── docker-compose.yml            # App + PostgreSQL + migration runner
├── Dockerfile                    # Multi-stage (frontend build + production runtime)
├── .dockerignore                 # Exclude node_modules, .env, .git
├── .env.example                  # Template (committed)
├── .env                          # Real secrets (gitignored)
│
├── server/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma         # Data model (Bots, Users, Transactions)
│   │   └── migrations/           # Migration history (committed)
│   └── src/
│       ├── server.js             # Express app entry point (API + webhooks + static)
│       ├── bot/
│       │   ├── manager.js        # BotManager class (instantiate, webhook, shutdown)
│       │   └── handlers.js       # Message/callback handlers (/start, /checkout, etc.)
│       ├── services/
│       │   ├── livepix.js        # LivePix payment creation + stealth PIX extraction
│       │   ├── logger.js         # Interaction logging (fire-and-forget writes)
│       │   └── retention.js      # Scheduled cleanup of old interactions
│       ├── middleware/
│       │   ├── auth.js           # Admin authentication middleware
│       │   └── webhook.js        # Webhook dispatcher middleware
│       └── routes/
│           └── api.js            # Admin REST API routes
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx              # React entry point
│       ├── App.jsx               # Router layout
│       ├── components/
│       │   ├── BotForm.jsx       # Create/edit bot form
│       │   ├── BotTable.jsx      # Bot list with status toggle
│       │   ├── StatusBadge.jsx   # ACTIVE/INACTIVE indicator
│       │   └── InteractionsView.jsx # Paginated interaction log viewer
│       └── pages/
│           └── Dashboard.jsx     # Main admin page
│
└── .dump/                        # Documentation & ADRs (not deployed)
    ├── 1research.md              # ← This file
    ├── 2_plan.md                 # Implementation plan
    └── ADR/
        ├── 001-livepix-pix-code-fallback.md
        └── 002-button-styles.md
```

---

## 15. Key Design Decisions

| Decision | Rationale | Trade-off |
|---|---|---|
| **Single container** (not microservices) | Simpler deployment, no inter-service networking, easier monitoring | Less horizontal scaling flexibility — acceptable for single-admin use case |
| **Full interaction logging** (`interactions` table) | Complete audit trail for debugging, monitoring, and dispute resolution | ~300K rows/month storage; retention policy (90 days) keeps it bounded |
| **In-memory bot registry** (Map) | Fast dispatching, no DB read on every webhook call | Lost on server restart; rebuilt from DB on startup |
| **`Composer.fork()` for async processing** | Built-in Telegraf feature, no custom threading logic | All bot logic runs on main thread; acceptable with Node.js async I/O |
| **Prisma `String` for transaction status** | Statuses evolve (PENDING → PAID → EXPIRED → REFUNDED); enum migration is costly | No DB-level constraint on valid values; enforcement in application layer |
| **Prisma `enum` for payment method + bot status** | Truly closed sets; new methods require deliberate schema change | Migration required for new payment methods — rare occurrence |
| **`cuid()` over autoincrement** | Distributed-safe, no sequence collisions, URL-friendly | Slightly larger index size (25 chars vs 4-8 bytes for int) |
| **Stealth PIX extraction** (undocumented endpoint) | LivePix official API doesn't return raw PIX code | Endpoint may break without notice; graceful fallback to checkout URL mitigates |
| **1.5s propagation delay** before stealth call | LivePix backend needs time to index new payment | Adds latency; users wait ~2-3s total for PIX code |
| **Browser header spoofing** for stealth endpoint | Bypasses Cloudflare WAF that blocks programmatic access | LivePix may change detection; header set is configurable |
| **`file_id` for media** (not raw URLs) | Permanent, hosted by Telegram, no bandwidth costs | Requires pre-upload to Telegram to obtain `file_id` |

---

## 16. References

- [Telegraf v4 Documentation](https://telegraf.js.org/)
- [Telegraf WebhookCallback Source](https://github.com/telegraf/telegraf/blob/v4.16.3/src/telegraf.ts)
- [Telegraf Composer.fork() Source](https://github.com/telegraf/telegraf/blob/v4.16.3/src/composer.ts)
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/prisma-schema/overview)
- [Prisma Migrate Deploy](https://www.prisma.io/docs/orm/prisma-migrate/workflows/production-troubleshooting)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Telegram Bot API — setWebhook](https://core.telegram.org/bots/api#setwebhook)
- [ADR-001: LivePix PIX Code Fallback](./ADR/001-livepix-pix-code-fallback.md)
- [ADR-002: Button Color Styles](./ADR/002-button-styles.md)
