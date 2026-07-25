# AGENTS.md — Botflix v2

Multi-bot Telegram payment gateway (LivePix PIX). Monorepo: Express backend + React admin SPA, single Docker container behind Traefik.

## Stack

- **Language:** TypeScript strict, ES2022, Node.js 20+
- **Backend:** Express 4, Telegraf 4, Prisma 6, PostgreSQL 16
- **Frontend:** React 18, Vite 6, Tailwind CSS 3, shadcn/ui, recharts
- **Package manager:** pnpm 9 (Corepack, workspace monorepo)
- **Job queue:** pg-boss (remarketing scheduling)
- **Monitoring:** Prometheus (`prom-client`), Grafana, Alertmanager
- **Testing:** Vitest (unit), k6 (load)
- **Runtime:** Docker Compose (db + migration + app), optional EasyPanel/Traefik

## File Organization

```
server/src/
  server.ts              — Express app entry, route mounting, cluster, startup/shutdown
  bot/
    manager.ts           — BotManager class (Telegraf instance, webhook registration per bot)
    handlers.ts          — All Telegram bot handler logic (/start, text, callbacks, LivePix)
    messageFlow.ts       — MessageStep type, normalizeMessageFlow(), BUTTON_STYLE_MAP, daily audio
    paymentFlow.ts       — PaymentFlow type, normalizePaymentFlow(), defaultPaymentFlow()
    remarketing.ts       — RemarketingConfig, DiscountTier, TimeComplimentConfig, normalize* helpers
    placeholders.ts      — resolveAllPlaceholders(): {name}, {time}, {time_compliment}, {amount}, {pix_code}, {checkout_url}
    botSettings.ts       — BotSettings type, normalize/load per-bot settings
    globalConfig.ts      — GlobalConfig type, load/update/getGlobalConfig() (singleton row in DB)
  routes/
    api.ts               — CRUD for bots, transactions, interactions, dashboard stats, remarketing states
    admin.ts             — GET/PUT /api/admin/config (GlobalConfig)
    botSettings.ts       — GET/PUT /api/bots/:id/settings, test-bark
    chat.ts              — User sessions, chat timeline, users list/detail
    facebookPixel.ts     — FB CAPI config + test event
    utmify.ts            — Utmify config + test order
    utils.ts             — File ID upload, load simulator
  services/
    prisma.ts            — PrismaClient instances (primary + analytics)
    botLifecycle.ts      — loadActiveBots, shutdownAllBots
    botRegistry.ts       — In-memory Map<string, BotManager> for O(1) webhook dispatch
    livepix.ts            — LivePix OAuth, payment creation, PIX code extraction
    remarketingQueue.ts  — pg-boss job scheduling for remarketing messages
    remarketingSender.ts — Sends individual remarketing messages
    paymentPoller.ts     — Background poller confirming LivePix payments (30s interval)
    notifications.ts     — Bark push notifications (purchase confirmations, system alerts)
    retention.ts         — Auto-purges old interactions
    entryStore.ts        — UTM parameter caching (in-memory, short-lived tokens)
    facebookPixel.ts     — FB CAPI event sending
    utmify.ts            — Utmify order tracking
  middleware/
    auth.ts              — Admin bearer token auth (timingSafeEqual)
    webhook.ts            — Webhook dispatcher (botId → BotManager map)
  utils/
    env.ts               — loadEnv(), validates required vars at startup
    serialize.ts         — sanitizeBot() strips token/fbAccessToken/utmifyApiToken from responses
    markdownToHtml.ts    — Telegram-friendly markdown → HTML converter
    rateLimiter.ts       — telegraf-rate-limit on telegram API calls
    metrics.ts           — Prometheus metrics (webhook errors, payment errors, app health)
    logger.ts            — Pino logger wrapper + flushAll()
    errors.ts             — HttpError class
    async.ts             — Async helpers
    media.ts             — Media file helpers
    telegram.ts          — Telegram API helpers

frontend/src/
  App.tsx                — React Router SPA
  pages/                 — 19 page components (Manager, Dashboard, Messages, Remarketing, Transactions, etc.)
  components/
    forms/               — MessageFlowEditor, PaymentFlowEditor, RemarketingEditor, TimeComplimentsEditor, MessagePreview, etc.
    layout/              — AppShell, Navigation
    ui/                  — shadcn/ui components
    bots/                — Bot list/grid cards
    shared/              — Shared components
  hooks/                 — useAuth, useBots, useStats, useInteractions, useTransactions, etc.
  lib/
    api.ts               — Axios client with Bearer auth, all API call functions
    helpers.ts           — Format helpers
    utils.ts             — General utilities
    csv.ts               — CSV export/import
```

## Database Schema (Prisma — PostgreSQL 16)

All Prisma model names are PascalCase, PostgreSQL tables use snake_case via `@@map()`.

### Bot (`bots`)
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String | Display name |
| token | String | AES-256-GCM encrypted Telegram bot token |
| messageFlow | Json | Array of MessageStep (welcome flow, default `"[]"`) |
| remarketing | Json | RemarketingConfig object (default `"{}"`) |
| paymentFlow | Json | PaymentFlow object (default `"{}"`) |
| timeCompliments | Json | TimeComplimentConfig (default `"{}"`) |
| settings | Json | Per-bot settings (timezone, max pix, bark, admin IDs, etc.) |
| photoUrl | String? | Bot profile photo |
| status | BotStatus | ACTIVE / INACTIVE / SUSPENDED (default ACTIVE) |
| fbPixelId | String? | Facebook pixel ID |
| fbAccessToken | String? | Facebook CAPI access token |
| fbEnabled | Boolean | FB CAPI enabled (default false) |
| utmifyApiToken | String? | Utmify API token |
| utmifyEnabled | Boolean | Utmify enabled (default false) |
| createdAt / updatedAt | DateTime | Auto-managed |

Relations: User[], Transaction[], Interaction[], UserSession[], RemarketingState[], PixelEvent[]
Indexes: [status]

### User (`users`)
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| botId | String | FK → Bot |
| telegramId | BigInt | Store as BigInt, serialize as string in JSON |
| username / firstName / lastName | String? | From Telegram |
| pixGenerations | Int (default 0) | Rate-limit counter for PIX code extraction |
| lastInteraction | DateTime? | Last user activity |
| currentSessionId / currentStepIndex | See below | Current session tracking |
| settings | Json (default `"{}"`) | Per-user settings |
| totalInteractions / totalPayments / totalAmount | Int/Int/Float | Aggregated stats |
| isBlocked | Boolean (default false) | Admin block |
| tags | Json (default `"[]"`) | Admin tags |
| notes | String? | Admin notes |

Unique: [botId, telegramId]
Indexes: [botId], [botId, createdAt]

### Transaction (`transactions`)
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| botId | String | FK → Bot |
| userId | String | FK → User |
| amount | Float | Payment amount (BRL) |
| paymentMethod | PaymentMethod | PIX / CREDIT_CARD |
| status | String | "PENDING" / "COMPLETED" (default "PENDING") |
| pixCode | String? | Raw PIX code |
| checkoutUrl | String? | LivePix checkout URL |
| livepixReference | String? | LivePix payment reference for verification |

Indexes: [botId, status], [botId, createdAt], [userId]

### Interaction (`interactions`)
| Field | Type | Notes |
|-------|------|-------|
| type | String | "message", "callback_query", "command", etc. |
| direction | String | "incoming" / "outgoing" |
| content | String? | Message text or description |
| payload | Json? | Full Telegram update (when LOG_PAYLOADS=true) |
| stepIndex | Int? | Which message flow step triggered this |
| buttonId | String? | Which button was clicked |
| messageId | BigInt? | Telegram message ID |
| chatId | BigInt? | Telegram chat ID |
| metadata | Json? | Additional context |

Auto-purged after `interactionRetentionDays` (default 90). Index: [botId, createdAt], [createdAt] (for retention purge)

### UserSession (`user_sessions`)
| Field | Type | Notes |
|-------|------|-------|
| status | String | "ACTIVE" / "CLOSED" |
| currentStepIndex | Int? | Current position in message flow |
| stepsCompleted | Json (default `"[]"`) | Array of completed step indices |
| messageCount | Int (default 0) | Messages in this session |
| metadata | Json (default `"{}"`) | Session metadata |
| startedAt | DateTime | Session start |
| endedAt | DateTime? | Session end |

Indexes: [botId, userId], [botId, status], [botId, startedAt desc]

### RemarketingState (`remarketing_states`)
| Field | Type | Notes |
|-------|------|-------|
| nextIndex | Int (default 0) | Next message index to send |
| totalSent | Int (default 0) | Total messages sent |
| nextSendAt | DateTime? | When to send next message (null = not scheduled) |
| burstUntil | DateTime? | End of burst mode window |
| retries | Int (default 0) | Retry counter |
| lastError | String? | Last error message |
| pgBossJobId | String? | Active pg-boss job ID |

Unique: [userId, botId]
Index: [botId, nextSendAt]

### PixelEvent (`pixel_events`)
CAPI event log: eventName, eventId, customData (Json), success (Boolean), statusCode, error.
Indexes: [botId, createdAt], [botId, eventName, createdAt]

### GlobalConfig (`global_config`)
Single row (`id = "global"`), stores a JSON `settings` field containing:
- callbackCooldownMs (default 7000)
- telegramRateLimit (default 25), telegramRateBurst (default 30)
- defaultMaxPixGenerations (default 5)
- paymentPollWindowMinutes (default 30)
- interactionRetentionDays (default 90)
- userCacheTtlMs (default 60000), userCacheMaxSize (default 10000)
- barkAlertEnabled (default false), barkAlertDeviceKey (default "")

Loaded at startup via `loadGlobalConfig()`, cached in memory, accessed via `getGlobalConfig()`.

## Message Customization System

All customizable messages are stored as JSON columns in the `Bot` table. Each bot has its own configuration.

### MessageStep Type (shared by all flows)

```typescript
type MessageStep = {
  id: string;                  // cuid or random UUID
  title: string;               // Admin label
  type: "TEXT" | "AUDIO" | "VIDEO" | "IMAGE";
  text?: string;               // Message text (supports markdown + placeholders)
  mediaUrls: string[];         // Telegram file_id or URLs
  delayMs: number;             // Delay before sending this step
  buttons: MessageButton[];    // Max 3 inline buttons
  chatAction?: boolean;        // Show "typing..." / "recording..."
  includeQrCode?: boolean;
  includePixCode?: boolean;
  includeCheckoutUrl?: boolean;
  isActive?: boolean;          // Can disable individual steps (defaults to true if absent)
  dailyAudios?: DailyAudioConfig;  // Day-of-week audio selection
  repeatAudios?: string[];     // Audio rotation for repeat visits
};
```

### MessageButton

```typescript
type MessageButton = {
  id: string;
  label: string;               // Max 80 chars
  color: "BLUE" | "GREEN" | "RED"; // Maps to Telegram styles
  action: "OPEN_URL" | "LIVEPIX_PAYMENT";
  url?: string;                // Required for OPEN_URL (HTTPS)
  price?: number;              // Required for LIVEPIX_PAYMENT (positive float)
};
```

### Bot JSON Columns & Their Types

| Column | TypeScript Type | Normalizer |
|--------|----------------|------------|
| `messageFlow` | `MessageStep[]` | `normalizeMessageFlow()` in `messageFlow.ts` |
| `paymentFlow` | `PaymentFlow` | `normalizePaymentFlow()` in `paymentFlow.ts` |
| `remarketing` | `RemarketingConfig` | `normalizeRemarketing()` in `remarketing.ts` |
| `timeCompliments` | `TimeComplimentConfig` | `normalizeTimeCompliments()` in `remarketing.ts` |
| `settings` | `BotSettings` | `normalizeBotSettings()` in `botSettings.ts` |

### PaymentFlow

```typescript
type PaymentFlow = {
  steps: MessageStep[];              // Payment steps shown before checkout
  verifyLabel: string;               // Label for the "Verify Payment" button (default "Verificar pagamento")
  pixCopyLabel: string;              // Label for "Copy PIX" button (default "Copiar PIX")
  verifyPaymentSuccessFlow: MessageStep[];  // Sent when payment is confirmed
  verifyPaymentFailFlow: MessageStep[];     // Sent when payment is still pending
  copyPixFlow: MessageStep[];               // Sent after PIX code is copied
  deliverables: MessageStep[];              // Sent after payment confirmation
};
```

### RemarketingConfig

```typescript
type RemarketingConfig = {
  enabled: boolean;
  intervalMs: number;           // Send interval (min 60000 when enabled)
  maxSends: number;             // Total messages to send per user
  messages: MessageStep[];      // Remarketing messages
  discountOffer: DiscountOfferConfig;
  skipStale: boolean;           // Skip users who haven't interacted recently
  initialDelayMs: number;       // Delay before first remarketing message
  burstIntervalMs: number;      // Burst mode interval (faster sends initially)
  burstDurationMs: number;      // How long burst mode lasts
  burstCycleMessages: boolean;  // Cycle through messages during burst
  useSeparateBurstMessages: boolean;
  burstMessages: MessageStep[]; // Separate messages for burst mode
};
```

### TimeComplimentConfig

```typescript
type TimeComplimentConfig = {
  timezone: string;             // IANA timezone, e.g. "America/Sao_Paulo"
  fallback: string;             // Fallback text when no preset matches
  presets: TimeComplimentPreset[];
};

type TimeComplimentPreset = {
  label: string;                // Text to insert, e.g. "Bom dia"
  startHour: number;            // 0-23
  startMinute: number;          // 0-59
  endHour: number;              // 0-23
  endMinute: number;            // 0-59
};
```

### Placeholder System (`server/src/bot/placeholders.ts`)

`resolveAllPlaceholders(text, user, timeCompliments?, payment?)` processes:

| Placeholder | Source | Description |
|-------------|--------|-------------|
| `{name}` | `user.firstName` | User's first name |
| `{name:fallback}` | `user.firstName` | Name with fallback if null |
| `{time}` | `timeCompliments.timezone` | Current local time (pt-BR, HH:MM format) |
| `{time_compliment}` | `timeCompliments.presets` | Time-based compliment based on hour ranges |
| `{amount}` | `payment.amount` | Amount formatted as `R$ X.XX` (amount is in cents) |
| `{pix_code}` | `payment.pixCode` | Raw PIX code wrapped in `<blockquote><code>` |
| `{checkout_url}` | `payment.checkoutUrl` | LivePix checkout URL |

**IMPORTANT:** `{amount}` value is in **cents** (integer). Divide by 100 for display (e.g., `2990` → `R$ 29.90`).

### DailyAudioConfig

```typescript
type DailyAudioConfig = {
  enabled: boolean;
  audios: Record<string, string>;  // Day → file_id, e.g. { "monday": "file_id_here" }
  fallback?: string;               // Fallback file_id if no match for today
  timezone?: string;               // Override for day-of-week resolution
};
```

### How to Add or Modify a Message Flow

1. **Define/update the TypeScript types** in `server/src/bot/messageFlow.ts` (for MessageStep/MessageButton) or the relevant flow file.
2. **Update the normalizer** (`normalizeMessageFlow()`, `normalizePaymentFlow()`, etc.) to validate new fields.
3. **Update the placeholder resolver** in `server/src/bot/placeholders.ts` if adding new placeholders.
4. **Update the frontend form editor** in `frontend/src/components/forms/` (MessageFlowEditor, PaymentFlowEditor, RemarketingEditor, or TimeComplimentsEditor).
5. **Update the sender logic** in `server/src/bot/handlers.ts` — this is where `MessageStep` objects are iterated and sent via Telegram API. The sender maps `step.type` to `sendMessage`/`sendPhoto`/`sendVideo`/`sendVoice`, resolves placeholders, and applies markdown→HTML conversion.
6. **Update any related API route** validation in `server/src/routes/` if the flow is stored/loaded differently.
7. **Test with `{name}`, `{time}`, `{time_compliment}`** placeholders to ensure resolution works at runtime.

## Admin API

**Auth:** All routes under `/api/*` require `Authorization: Bearer <ADMIN_PASSWORD>` header (constant-time comparison via `timingSafeEqual`). Only `/api/health` is public.

### Route Listing

| Method | Path | Handler File | Purpose |
|--------|------|-------------|---------|
| GET | `/api/health` | server.ts (inline) | Health check (public) |
| GET | `/api/bots` | routes/api.ts | List all bots (tokens stripped) |
| POST | `/api/bots` | routes/api.ts | Create bot (validates token, starts webhook) |
| PUT | `/api/bots/:id` | routes/api.ts | Update bot config (restarts webhook if token changed) |
| PATCH | `/api/bots/:id/status` | routes/api.ts | Change status (ACTIVE/INACTIVE/SUSPENDED) |
| DELETE | `/api/bots/:id` | routes/api.ts | Delete bot (stops webhook, cascades all data) |
| GET | `/api/bots/:id/transactions` | routes/api.ts | Paginated transactions |
| GET | `/api/bots/:id/interactions` | routes/api.ts | Paginated interactions (excludes hidden admin users) |
| GET | `/api/bots/:id/dashboard/stats` | routes/api.ts | Revenue, users, conversion rate, timeline |
| GET | `/api/bots/:id/remarketing-states` | routes/api.ts | Remarketing queue |
| POST | `/api/bots/:id/remarketing-states/cancel-all` | routes/api.ts | Cancel all remarketing for bot |
| GET | `/api/bots/:id/remarketing-states/export` | routes/api.ts | Export CSV |
| GET | `/api/bots/:id/settings` | routes/botSettings.ts | Per-bot settings |
| PUT | `/api/bots/:id/settings` | routes/botSettings.ts | Update per-bot settings |
| POST | `/api/bots/:id/settings/test-bark` | routes/botSettings.ts | Test Bark notification |
| GET | `/api/bots/:id/pixel` | routes/facebookPixel.ts | FB Pixel config |
| PUT | `/api/bots/:id/pixel` | routes/facebookPixel.ts | Update FB Pixel config |
| POST | `/api/bots/:id/pixel/test` | routes/facebookPixel.ts | Test pixel event |
| GET | `/api/bots/:id/utmify` | routes/utmify.ts | Utmify config |
| PUT | `/api/bots/:id/utmify` | routes/utmify.ts | Update Utmify config |
| POST | `/api/bots/:id/utmify/test` | routes/utmify.ts | Test utmify order |
| GET | `/api/bots/:id/sessions` | routes/chat.ts | User sessions |
| GET | `/api/bots/:id/sessions/:sid/chat` | routes/chat.ts | Chat timeline |
| GET | `/api/bots/:id/users` | routes/chat.ts | Users list |
| GET | `/api/bots/:id/users/:uid` | routes/chat.ts | User detail |
| PATCH | `/api/bots/:id/users/:uid` | routes/chat.ts | Update user (tags, notes, block) |
| GET | `/api/admin/config` | routes/admin.ts | Global config |
| PUT | `/api/admin/config` | routes/admin.ts | Update global config |
| POST | `/api/utils/file-id` | routes/utils.ts | Upload file to Telegram for file_id |
| POST | `/api/utils/simulate-load` | routes/utils.ts | Load simulator |
| POST | `/api/bots/:botId/payment/simulate-confirm` | server.ts (inline) | Manually confirm payment for testing |
| POST | `/api/entry` | server.ts (inline) | Store UTM parameters (public) |

## Environment Variables

Validated at startup via `loadEnv()` in `server/src/utils/env.ts`. All variables are `UPPER_SNAKE_CASE`.

Required:
- `DATABASE_URL` — PostgreSQL connection string
- `DOMAIN` — Hostname without protocol (e.g. `botflix.example.com`)
- `ADMIN_PASSWORD` — Bearer token for all /api routes
- `LIVEPIX_CLIENT_ID` — LivePix OAuth client ID
- `LIVEPIX_CLIENT_SECRET` — LivePix OAuth client secret

Optional:
- `APP_PORT` (default 3001)
- `NODE_ENV` (default "production")
- `LIVEPIX_REDIRECT_URL` (default `https://t.me/{DOMAIN}`)
- `MAX_PIX_GENERATIONS` (default 5)
- `INTERACTION_RETENTION_DAYS` (default 90)
- `LOG_PAYLOADS` (default false)
- `WORKER_COUNT` (default 1, 0 = auto-detect CPUs)
- `DROP_PENDING_UPDATES` (default false)
- `PAYMENT_POLL_WINDOW_MINUTES` (default 30)
- `GRAFANA_USER` / `GRAFANA_PASSWORD` (for Grafana container)

## Conventions & Gotchas

### Must-Follow Rules

1. **BigInt serialization:** `telegramId` and `messageId`/`chatId` are `BigInt` in Prisma. All Express routes must pass responses through `serializeJson()` or manually use `BigInt.prototype.toJSON`. The global `BigInt.prototype.toJSON` override is set at the top of `server.ts`. Without this, JSON.stringify throws on BigInt values.

2. **Token sanitization:** Always use `sanitizeBot()` from `serialize.ts` before returning bot data in any API response. This strips `token`, `fbAccessToken`, and `utmifyApiToken`. Never expose encrypted tokens or API keys.

3. **Composer.fork():** All bot handlers in `handlers.ts` MUST use `Composer.fork()` (via `composer.fork()`). Without this, Telegram waits for the HTTP response, causing timeout retries and double-processing.

4. **`@@map` snake_case:** Prisma model fields are camelCase, but SQL tables use `@@map("snake_case_name")`. Migration names are `YYYYMMDDHHMMSS_description`. Never mix conventions.

5. **Domain format:** `DOMAIN` env var must be hostname only (no protocol prefix). Setting to `localhost` in dev skips Telegram webhook registration.

6. **Never log secrets:** Bot tokens, admin passwords, encryption keys, and LivePix secrets must never appear in log output.

7. **Frontend builds into server:** The React SPA builds to `server/public/`. Express serves it as static files. In production, the frontend is embedded in the server container.

8. **File naming:** `camelCase.ts` for services/utils/routes, `PascalCase.tsx` for React components. Test files use `*.test.ts` in `server/tests/`.

9. **Prisma migration command:** `corepack pnpm --filter @botflix/server prisma:migrate`

10. **PIX rate limit:** `User.pixGenerations` is incremented atomically per PIX code extraction attempt. After exceeding `MAX_PIX_GENERATIONS` (default 5), stealth extraction is skipped but official payment creation still works.

11. **Fire-and-forget webhooks:** `POST /webhook/:botId` responds 200 OK immediately via `Composer.fork()`, then processes asynchronously.

12. **Multi-bot webhook routing:** Single route `POST /webhook/:botId` dispatches to the correct `BotManager` via in-memory `Map<string, BotManager>` — O(1) lookup.

13. **Cluster mode:** When `WORKER_COUNT > 1`, only worker 0 registers webhooks and runs payment poller. Primary process only supervises.

14. **Bot token encryption:** Tokens are AES-256-GCM encrypted in the DB. Decrypted at runtime when bots are loaded via `botLifecycle.ts`. API responses never include tokens.

15. **Graceful shutdown:** SIGINT/SIGTERM → stop remarketing → close HTTP → stop bots (delete webhooks) → disconnect Prisma → exit.

### Common Patterns When Adding Features

- **New bot JSON column:** Add field to Prisma schema → create migration → add TypeScript type + normalizer in `bot/` → add frontend form editor → add API route if needed for separate CRUD
- **New placeholder:** Add regex/replacement in `resolveAllPlaceholders()` → update frontend `MessagePreview` component → document in placeholder info tooltip (`UserPlaceholdersInfo.tsx`)
- **New payment integration:** Add service in `services/` → add to `BotManager` constructor → call from `handlers.ts` payment flow
- **New admin page:** Add route in `App.tsx` → create page component in `pages/` → add API call in `lib/api.ts` → add navigation link in layout component

## Architecture

### Startup Sequence
1. `loadEnv()` — validates all required env vars
2. `loadGlobalConfig()` — loads/caches GlobalConfig from DB (or defaults)
3. `initRemarketingQueue()` — starts pg-boss
4. `loadActiveBots(env)` — queries all ACTIVE bots, decrypts tokens, creates BotManager instances, registers Telegram webhooks
5. `startRemarketingWorker()` — starts pg-boss consumer
6. `rescheduleAllRemarketingJobs()` — re-queues pending remarketing jobs
7. `startPaymentPoller()` — background 30s interval polling for PENDING transactions

### Bot Lifecycle
- **Create:** `POST /api/bots` → validates Telegram token → inserts bot with encrypted token → starts webhook
- **Update:** `PUT /api/bots/:id` → if token changed, stops old webhook → updates DB → starts new webhook
- **Delete:** `DELETE /api/bots/:id` → stops webhook → DB cascade deletes all related data
- **Runtime:** Bot receives messages via webhook → `webhookDispatcher` looks up `BotManager` by botId → Telegraf processes
