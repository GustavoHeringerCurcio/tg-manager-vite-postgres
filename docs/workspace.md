# Botflix v2 — Project Workspace

Multi-bot Telegram payment gateway platform using LivePix PIX payments. Monorepo with an Express backend
and React admin dashboard, deployed as a single Docker container behind Traefik.

---

## Team

_<team-size>_

---

## Monorepo Packages

### server (`@botflix/server`)

TypeScript Express API + Telegraf bot framework + Prisma ORM. Handles Telegram webhooks, multi-bot
lifecycle management, PIX payment generation via LivePix OAuth, interaction logging, and remarketing
scheduling. Serves the compiled React frontend as static files in production.

Stack: Express 4, Telegraf 4, Prisma 6, tsx (dev server)

Port: 3000 (configurable via `APP_PORT`)

### frontend (`@botflix/frontend`)

React 18 SPA admin dashboard for bot management, transaction history, interaction logs, and
remarketing flow configuration. Vite dev server proxies `/api` to the backend.

Stack: React 18, Vite 6, Tailwind CSS 3, TypeScript

Build output → `server/public/`

---

## Database

### PostgreSQL 16

Single database accessed via Prisma ORM from the server package. Tables use `snake_case` via `@@map`
but Prisma fields are `camelCase`.

| Model | Table | Purpose |
|-------|-------|---------|
| `Bot` | `bots` | Bot configuration: name, encrypted token, message flow JSON, remarketing JSON, checkout amount, status |
| `User` | `users` | Telegram users per bot, PIX generation rate-limit counter |
| `Transaction` | `transactions` | PIX/credit card payment records with LivePix references |
| `Interaction` | `interactions` | Fire-and-forget log of every message, callback, command (auto-purged after `INTERACTION_RETENTION_DAYS`) |
| `RemarketingState` | `remarketing_states` | Per-user remarketing progress (next message index, send queue) |

Relations:
- `Bot` 1→N `User`, `Transaction`, `Interaction`, `RemarketingState`
- `User` 1→N `Transaction`, `Interaction`, `RemarketingState`
- All foreign keys cascade on bot delete

---

## Infrastructure

| Component | Technology |
|-----------|-----------|
| Container runtime | Docker + Docker Compose |
| Reverse proxy | Traefik (EasyPanel integration, Let's Encrypt TLS) |
| Database | PostgreSQL 16 Alpine |
| Runtime | Node.js 20 Alpine (non-root user) |
| Package manager | pnpm 9 (Corepack, workspace monorepo) |

### Docker Compose Services

| Service | Purpose |
|---------|---------|
| `db` | PostgreSQL with `pg_isready` health check |
| `db-migrate` | One-shot Prisma migration runner, waits for healthy db |
| `app` | Express server, depends on db healthy + migrations complete |

### Deployment

`setup.sh` handles interactive VPS provisioning: prompts for domain, LivePix credentials,
auto-generates secrets, builds and starts containers. Docker network `easypanel` is external
(Traefik integration).

---

## Architectural Rules

1. **Multi-bot webhook routing** — Single Express route `POST /webhook/:botId` dispatches to the
   correct `BotManager`'s Telegraf instance via an in-memory `Map<string, BotManager>`. Each bot has
   a unique `secret_token` validated by Telegram headers. O(1) dispatch.

2. **Fire-and-forget Telegram processing** — All bot handlers use `Composer.fork()` which returns
   200 OK to Telegram immediately, then runs logic asynchronously. Prevents Telegram retry/timeout
   loops.

3. **Encryption at rest** — Bot tokens are AES-256-GCM encrypted (iv:authTag:ciphertext) before DB
   storage. Decrypted only at runtime when bots are loaded. API responses never include token values
   (`sanitizeBot` strips them).

4. **PIX fallback** — PIX code extraction from LivePix's undocumented endpoint may fail; the system
   always falls back to showing the LivePix checkout URL. Never crashes on PIX extraction failure.

5. **Graceful shutdown** — SIGINT/SIGTERM → stop remarketing poller → close HTTP server → stop all
   bots (delete Telegram webhooks) → disconnect Prisma → exit.

6. **Env validation at startup** — `loadEnv()` validates all required variables fail-fast. Domain is
   validated (no protocol prefix). Encryption key is validated for exactly 32 bytes (accepts hex,
   base64, or raw UTF-8 of correct length).

---

## Security Model

- **Admin auth**: Bearer token (`Authorization: Bearer <ADMIN_PASSWORD>`) using `timingSafeEqual`
  for constant-time comparison. All `/api/*` routes protected; `/api/health` is public.
- **Bot tokens**: AES-256-GCM encrypted with `ENCRYPTION_KEY` (32 bytes). Never returned in API
  responses. Decrypted only when loading bot instances into memory.
- **Webhook verification**: Telegram `X-Telegram-Bot-Api-Secret-Token` header validated per-bot
  using a unique `secret_token` derived from the bot token.

---

## Data Models (Prisma)

```prisma
enum BotStatus { ACTIVE, INACTIVE, SUSPENDED }
enum PaymentMethod { PIX, CREDIT_CARD }

model Bot {
  id             String    @id @default(cuid())
  name           String
  token          String    // AES-256-GCM encrypted
  messageFlow    Json      @default("[]")
  remarketing    Json      @default("{}")
  checkoutAmount Float     @default(29.9)
  status         BotStatus @default(ACTIVE)
  // relations: users[], transactions[], interactions[], remarketingStates[]
}

model User {
  id              String  @id @default(cuid())
  botId           String
  telegramId      BigInt  // serialized as string in JSON
  pixGenerations  Int     @default(0)  // rate-limit counter
  // @@unique([botId, telegramId])
}

model Transaction {
  status           String  @default("PENDING")
  pixCode          String?
  checkoutUrl      String?
  livepixReference String?
  paymentMethod    PaymentMethod
}

model Interaction {
  type      String   // "message", "callback_query", "command", etc.
  direction String   // "incoming" | "outgoing"
  payload   Json?    // full Telegram payload (when LOG_PAYLOADS=true)
  // retention: deleted after INTERACTION_RETENTION_DAYS (default 90)
}

model RemarketingState {
  nextIndex  Int       @default(0)
  totalSent  Int       @default(0)
  nextSendAt DateTime? // null = not scheduled
  // @@unique([userId, botId])
}
```

---

## Remarketing System

In-process poller (`setInterval`, 30s) — not a message queue. Scans `RemarketingState` for users
with `nextSendAt <= now`, sends the next message in the remarketing flow, increments `nextIndex` and
`totalSent`, schedules the next send with the configured delay.

Remarketing config per bot: JSON with `enabled`, `intervalMinutes`, and `messages[]` array. Each
message can have text, optional media (video/photo via Telegram `file_id`), and optional inline
buttons.

---

## Key Gotchas

1. **BigInt serialization** — `telegramId` is stored as `BigInt` in PostgreSQL/Prisma but must be
   serialized as a string in JSON responses. All API routes pass through `serializeJson()` which
   uses a BigInt-to-string JSON replacer. Forgetting this breaks JSON serialization.

2. **Token sanitization** — Always use `sanitizeBot()` before returning bot data in API responses.
   The raw `token` field contains the encrypted token string; exposing it leaks cryptographic
   material.

3. **Composer.fork() is required** — Bot handlers that don't use `Composer.fork()` will keep
   Telegram waiting for a response, triggering retries. All handlers in `bot/handlers.ts` must use
   the forked composer.

4. **`@@map` snake_case convention** — Prisma model names are PascalCase, but PostgreSQL tables use
   snake_case via `@@map()`. Prisma migration names are `YYYYMMDDHHMMSS_description`. Don't mix
   conventions.

5. **PIX rate limit counter** — `User.pixGenerations` is atomically incremented per PIX code
   request. Stealth extraction is skipped when counter exceeds `MAX_PIX_GENERATIONS` (default 5).
   Only the official payment creation still proceeds.

6. **Domain format** — `DOMAIN` env var must be host only (no protocol). Validated at startup.
   Setting it to `localhost` in dev skips Telegram webhook registration (bots are created but
   webhooks are not set — use `npm run dev:server` with a tunnel like ngrok for local webhook
   testing).

---

## Behavior Rules

- Use TypeScript strict mode across all server and frontend code
- Follow existing file naming: `camelCase.ts` for services/utils, `PascalCase.tsx` for React
  components
- Test files use `*.test.ts` suffix and live in `server/tests/`
- Prisma migrations run via `corepack pnpm --filter @botflix/server prisma:migrate`
- Environment variables: `UPPER_SNAKE_CASE`, validated at startup in `server/src/utils/env.ts`
- Never log bot tokens, admin passwords, encryption keys, or LivePix secrets
- Frontend builds into `server/public/` — the Express server serves the SPA in production
- All API routes return `serializeJson()` to handle BigInt serialization

---

## Task Template

When creating tickets, tasks, or feature requests, use this structure:

**Title** — Short, descriptive name for the task

**Goal** — What problem does this solve, and why is it valuable?

**Background** — Relevant context: which package(s) are affected, existing constraints, dependencies,
and any historical decisions that inform the work

**Scope** — Concrete boundaries: what is in scope and what is explicitly out of scope

**Deliverable** — The specific, verifiable artifact(s) that define completion (e.g., API endpoint,
UI component, migration, test, doc update)
