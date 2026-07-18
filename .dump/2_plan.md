# Botflix v2 - Professional Implementation Plan

> Implementation roadmap for Botflix v2, based on `.dump/1research.md` and the active ADRs.
> This plan is written for phased delivery, clear acceptance criteria, and production-readiness.

---

## 1. Project Goal

Build a single-admin platform for managing multiple Telegram bots that act as payment gateways using LivePix PIX payments.

The platform must allow an admin to:

- Create, edit, activate, deactivate, and delete Telegram bots.
- Configure each bot's welcome media, messages, payment buttons, and support links.
- Automatically register Telegram webhooks for active bots.
- Generate LivePix payments from Telegram callback buttons.
- Show PIX copy-and-paste codes inside Telegram when available.
- Fall back to LivePix checkout URLs when PIX code extraction fails.
- Track users, transactions, and every relevant bot interaction.
- Monitor bot activity from a React admin dashboard.

Target scale: 10,000+ Telegram end-user interactions per day across all bot instances.

---

## 2. Final Product Scope

### Included In V1

- Express backend with REST API, Telegram webhooks, and static frontend serving.
- React/Vite/Tailwind admin dashboard.
- PostgreSQL database managed by Prisma.
- Multi-bot Telegraf webhook runtime.
- LivePix official payment creation.
- LivePix PIX code extraction through the internal webservice described in ADR-001.
- Official support for Telegram inline button `style` values from ADR-002.
- Interaction logging for messages, callback queries, and outgoing bot responses.
- Simple admin authentication using `ADMIN_PASSWORD` from `.env`.
- Docker Compose deployment with app, PostgreSQL, and migration runner.

### Excluded From V1

- Multi-admin roles and permissions.
- Horizontal scaling across multiple app instances.
- Advanced payment reconciliation webhooks unless LivePix webhook details are added later.
- External media hosting. Telegram `file_id` is the preferred media reference.
- Complex analytics beyond basic interaction and transaction views.

---

## 3. Architectural Decisions

| Area | Decision | Reason |
|---|---|---|
| Backend | Node.js + Express | Simple API, webhook, and static serving layer. |
| Bot framework | Telegraf v4 | Mature Telegram bot framework with webhook support. |
| Frontend | React + Vite | Fast admin dashboard development and static production build. |
| Styling | Tailwind CSS | Quick UI implementation with small production bundle. |
| Database | PostgreSQL | Reliable relational database for users, bots, and payments. |
| ORM | Prisma | Declarative schema, migrations, and ergonomic queries. |
| Amount storage | `Float` | Simpler implementation for V1. Amounts are BRL with two decimal places. |
| Deployment | Docker Compose | App, database, and migration runner are easy to run together. |
| Bot registry | In-memory `Map` | Fast webhook dispatch and simple lifecycle management. |
| Admin auth | `ADMIN_PASSWORD` from `.env` | Simple single-admin protection for V1. |
| Button styling | ADR-002 official | Use Telegram inline keyboard `style` field as a supported project requirement. |
| LivePix PIX extraction | ADR-001 official | Best-effort PIX copy-and-paste extraction with checkout URL fallback. |

---

## 4. Target Repository Structure

```txt
telegram-botflix-v2/
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── .env.example
├── README.md
│
├── server/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── server.js
│       ├── bot/
│       │   ├── manager.js
│       │   └── handlers.js
│       ├── middleware/
│       │   ├── auth.js
│       │   └── webhook.js
│       ├── routes/
│       │   └── api.js
│       ├── services/
│       │   ├── botRegistry.js
│       │   ├── crypto.js
│       │   ├── livepix.js
│       │   ├── logger.js
│       │   ├── prisma.js
│       │   └── retention.js
│       └── utils/
│           ├── async.js
│           ├── env.js
│           └── serialize.js
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── lib/
│       │   └── api.js
│       ├── components/
│       │   ├── BotForm.jsx
│       │   ├── BotTable.jsx
│       │   ├── InteractionsView.jsx
│       │   ├── StatusBadge.jsx
│       │   └── TransactionsView.jsx
│       └── pages/
│           └── Dashboard.jsx
│
└── .dump/
    ├── 1research.md
    ├── 2_plan.md
    └── ADR/
        ├── 001-livepix-pix-code-fallback.md
        └── 002-button-styles.md
```

---

## 5. Environment Variables

The application must fail fast during startup if required environment variables are missing.

```env
# App
NODE_ENV=production
APP_PORT=3000
DOMAIN=botflix.example.com
ADMIN_PASSWORD=change-me

# Database
POSTGRES_USER=botflix
POSTGRES_PASSWORD=change-me
POSTGRES_DB=botflix
DATABASE_URL=postgresql://botflix:change-me@db:5432/botflix?schema=public

# Security
ENCRYPTION_KEY=32-byte-base64-or-hex-secret

# LivePix
LIVEPIX_CLIENT_ID=change-me
LIVEPIX_CLIENT_SECRET=change-me

# Bot behavior
MAX_PIX_GENERATIONS=5
INTERACTION_RETENTION_DAYS=90
LOG_PAYLOADS=false
```

Notes:

- `.env.example` is committed.
- `.env` is ignored by Git.
- `ADMIN_PASSWORD` protects the admin API and dashboard.
- `ENCRYPTION_KEY` encrypts Telegram bot tokens before database storage.
- `DOMAIN` is required to register Telegram webhooks.

---

## 6. Database Implementation

### 6.1 Prisma Models

Implement these models:

- `Bot`
- `User`
- `Transaction`
- `Interaction`

### 6.2 Bot

Stores one Telegram bot configuration.

Important fields:

- `id`
- `name`
- `token`, encrypted at rest
- `welcomeVideoUrl`
- `welcomeText`
- `checkoutButtonText`
- `supportButtonText`
- `supportUrl`
- `status`
- timestamps

### 6.3 User

Stores Telegram users per bot.

Important fields:

- `botId`
- `telegramId` as `BigInt`
- Telegram profile fields
- `pixGenerations`
- `lastInteraction`

Rules:

- Unique key: `[botId, telegramId]`.
- Same Telegram user can exist once per bot.
- API responses must serialize `BigInt` safely as strings.

### 6.4 Transaction

Stores payment attempts.

Important fields:

- `botId`
- `userId`
- `amount Float`
- `paymentMethod`
- `status String`
- `pixCode`
- `checkoutUrl`
- timestamps

Rules:

- `status` remains a string to allow future LivePix status changes without enum migrations.
- `amount` stays `Float` for V1 simplicity.

### 6.5 Interaction

Stores audit logs for bot activity.

Important fields:

- `botId`
- `userId`, nullable
- `type`
- `direction`
- `content`
- `payload`, optional JSON
- `createdAt`

Rules:

- Store `payload` only when `LOG_PAYLOADS=true`.
- Truncate `content` to 500 characters.
- Use retention cleanup for old records.

### Acceptance Criteria

- Prisma schema is committed.
- Initial migration is generated.
- `prisma migrate deploy` works in Docker.
- `GET /api/health` confirms DB connectivity.

---

## 7. Backend Foundation

### Tasks

- Create Express app.
- Add JSON body parser.
- Add `/api/health` route.
- Add admin auth middleware.
- Add API router.
- Add Telegram webhook dispatcher.
- Add static frontend serving for production.
- Add graceful shutdown.
- Add Prisma singleton service.
- Add environment validation.

### Admin Authentication

Use simple password-based protection for V1.

Recommended behavior:

- Admin dashboard sends `Authorization: Bearer <ADMIN_PASSWORD>`.
- Backend compares token to `process.env.ADMIN_PASSWORD`.
- Protect all `/api/*` routes except `/api/health` if health must stay public.
- Keep webhook routes outside admin auth.

### Acceptance Criteria

- Server starts with valid env vars.
- Server refuses to start when required env vars are missing.
- `/api/health` returns uptime and DB status.
- Protected API routes reject missing or invalid admin password.

---

## 8. Bot Lifecycle Management

### Runtime Model

Use an in-memory registry:

```js
const botRegistry = new Map();
```

Each active bot gets a `BotManager` instance containing:

- bot ID
- decrypted Telegram token
- Telegraf instance
- webhook path
- Telegram webhook secret token
- current bot configuration

### Startup Flow

1. Connect to database.
2. Clean old interactions according to retention setting.
3. Load all bots where `status = ACTIVE`.
4. Decrypt tokens.
5. Instantiate `BotManager` for each bot.
6. Register Telegram webhook for each active bot.
7. Store managers in `botRegistry`.
8. Start Express server.

### Bot Create Flow

1. Admin submits bot config.
2. Backend validates input.
3. Backend encrypts Telegram token.
4. Prisma creates `Bot` record.
5. Backend creates `BotManager`.
6. Backend calls `setWebhook`.
7. Registry stores manager.
8. API returns bot without plaintext token.

### Bot Deactivate Flow

1. Admin sets status to `INACTIVE`.
2. Backend updates DB.
3. Backend gets manager from registry.
4. Manager calls `deleteWebhook`.
5. Manager stops Telegraf instance.
6. Registry removes bot.

### Webhook Dispatch

Use one Express route:

```txt
POST /webhook/:botId
```

The dispatcher resolves `botId` from `botRegistry` and delegates to the matching Telegraf webhook middleware.

### Acceptance Criteria

- Active bots are loaded after server restart.
- Creating a bot registers its webhook.
- Deactivating a bot deletes its webhook.
- Deleting a bot stops runtime and cascades DB data.
- Unknown webhook bot IDs return `404`.

---

## 9. Telegram Bot Behavior

### `/start` Flow

1. Receive `/start`.
2. Upsert user by `[botId, telegramId]`.
3. Log incoming message.
4. Send immediate greeting.
5. Wait short humanized delay.
6. Send configured welcome video with configured caption.
7. Build inline keyboard dynamically from bot config.
8. Log outgoing responses.

### Checkout Callback Flow

1. User clicks checkout button.
2. Log incoming callback query.
3. Answer callback query quickly.
4. Upsert/update user.
5. Check and increment `pixGenerations`.
6. Create LivePix payment.
7. Try PIX code extraction if below generation limit.
8. Create transaction record.
9. Send Telegram payment instructions.
10. Log outgoing response.

### Support Button Flow

Support buttons should use Telegram URL buttons. No backend callback is required for URL-only support buttons.

### Button Style Requirement

ADR-002 is official for this project.

Inline keyboard buttons may include:

```js
{ text, callback_data, style }
```

Supported styles:

- `primary`
- `success`
- `danger`

### Acceptance Criteria

- `/start` creates or updates a user.
- Bot messages use database configuration, not hardcoded copy.
- Checkout button starts payment flow.
- Support URL button appears only when `supportUrl` is configured.
- Button `style` values are included according to ADR-002.

---

## 10. LivePix Payment Service

### Responsibilities

The LivePix service owns:

- OAuth2 client credentials authentication.
- Access token caching.
- Payment creation through official API.
- Checkout ID extraction from `redirectUrl`.
- 1.5 second propagation delay before PIX extraction.
- PIX code extraction through ADR-001 webservice.
- Retry/backoff for transient failures.
- Checkout URL fallback when extraction fails.

### Official Payment Creation

Expected result:

- LivePix payment reference.
- LivePix checkout URL.

The checkout URL is the reliable fallback and must always be saved when payment creation succeeds.

### PIX Code Extraction

Use:

```txt
POST https://webservice.livepix.gg/checkout/payment/{checkoutId}
```

Body:

```json
{ "method": "pix" }
```

Rules:

- Apply browser-like headers from research document.
- Retry network errors, 429, 5xx, and Cloudflare-style non-JSON responses.
- Do not retry hard 4xx JSON errors.
- Swallow extraction failures and return `pixCode: undefined`.

### Rate Limiting

Use `MAX_PIX_GENERATIONS` per user.

Behavior:

- Increment user's `pixGenerations` when checkout is requested.
- If user exceeds limit, skip stealth PIX extraction.
- Still create official LivePix payment and return checkout URL.

### Acceptance Criteria

- LivePix token is reused until expiry.
- Payment creation persists a transaction.
- PIX extraction failure does not crash the bot.
- User always receives either PIX code or checkout URL.
- `MAX_PIX_GENERATIONS` prevents excessive stealth calls.

---

## 11. Interaction Logging

### Events To Log

- Incoming text messages.
- Incoming callback queries.
- Outgoing greetings.
- Outgoing welcome videos.
- Outgoing payment instructions.
- Payment flow failures shown to users.

### Logging Rules

- Fire-and-forget writes are acceptable.
- Logging must never block Telegram response flow.
- Logging errors are written to server logs only.
- `payload` is stored only when `LOG_PAYLOADS=true`.
- `content` is truncated to 500 characters.

### Retention

Use `INTERACTION_RETENTION_DAYS`.

Behavior:

- Default: 90 days.
- Run cleanup on server startup.
- If value is `0`, disable cleanup.

### Acceptance Criteria

- Interactions appear in database after Telegram messages.
- Retention cleanup deletes old records only.
- Logging failures do not break bot handlers.

---

## 12. Admin API

### Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | App and DB health. |
| `GET` | `/api/bots` | List bots. |
| `POST` | `/api/bots` | Create bot and register webhook. |
| `GET` | `/api/bots/:id` | Get bot details. |
| `PUT` | `/api/bots/:id` | Update bot config. |
| `PATCH` | `/api/bots/:id/status` | Activate or deactivate bot. |
| `DELETE` | `/api/bots/:id` | Delete bot and owned records. |
| `GET` | `/api/bots/:id/transactions` | Paginated transactions. |
| `GET` | `/api/bots/:id/interactions` | Paginated interactions. |
| `GET` | `/api/bots/:id/interactions/stats` | Basic interaction stats. |

### API Safety Rules

- Never return plaintext bot tokens.
- Validate all route params and request bodies.
- Serialize `BigInt` values as strings.
- Use pagination for list endpoints.
- Use clear error messages without leaking secrets.

### Acceptance Criteria

- Admin can manage bots through API.
- Status changes affect both DB and runtime registry.
- Transactions and interactions support pagination.
- Invalid input returns `400`.
- Unknown records return `404`.

---

## 13. Admin Dashboard

### Pages And Components

Implement a compact single-admin dashboard with:

- Login/password gate using `ADMIN_PASSWORD` as bearer token.
- Bot create/edit form.
- Bot list table.
- Active/inactive status toggle.
- Delete confirmation.
- Transactions table.
- Interactions table.
- Basic stats cards.

### Bot Form Fields

| Field | Input |
|---|---|
| Bot name | Text |
| Bot token | Password/text |
| Welcome video URL/file ID | Text |
| Welcome text | Textarea |
| Checkout button text | Text |
| Checkout button style | Select: `primary`, `success`, `danger` |
| Support button text | Text |
| Support URL | Text |
| Support button style | Select: `primary`, `success`, `danger` |

### Dashboard Rules

- Do not expose encrypted token value.
- Token field is required on create.
- Token field is optional on edit, only updating when non-empty.
- Show API errors clearly.
- Keep layout usable on desktop and mobile.

### Acceptance Criteria

- Admin can log in with configured password.
- Admin can create and edit bots.
- Admin can activate/deactivate bots.
- Admin can view interactions and transactions.
- Frontend builds into static files served by Express.

---

## 14. Docker And Deployment

### Services

Use Docker Compose services:

| Service | Purpose |
|---|---|
| `db` | PostgreSQL 16 database. |
| `db-migrate` | One-shot Prisma migration runner. |
| `app` | Express API, webhooks, and static frontend. |

### Dockerfile

Use multi-stage build:

1. Build frontend.
2. Install backend production dependencies.
3. Generate Prisma client.
4. Copy frontend `dist` into backend `public`.
5. Run as non-root user.

### Compose Startup Order

1. PostgreSQL starts.
2. PostgreSQL health check passes.
3. `db-migrate` runs `prisma migrate deploy`.
4. App starts.
5. App loads active bots and registers webhooks.

### Acceptance Criteria

- `docker compose up --build` starts all services.
- Migrations run successfully.
- App serves `/api/health`.
- App serves React dashboard.
- PostgreSQL data persists in named volume.

---

## 15. Security Requirements

### Required For V1

- Protect admin dashboard/API with `ADMIN_PASSWORD`.
- Encrypt Telegram bot tokens before storing them.
- Never log bot tokens, admin password, or LivePix secrets.
- Validate Telegram webhook secret token.
- Keep `.env` out of Git.
- Use HTTPS in production through reverse proxy or hosting provider.
- Restrict CORS when serving dashboard from a separate origin.
- Use non-root Docker runtime user.

### Acceptance Criteria

- Protected routes reject unauthorized requests.
- Database does not contain plaintext Telegram tokens.
- Logs do not expose secrets.
- Webhook dispatch only accepts valid Telegram webhook secret headers.

---

## 16. Testing Strategy

### Backend Tests

Cover:

- Environment validation.
- Auth middleware.
- Bot API CRUD.
- BigInt serialization.
- LivePix fallback behavior.
- Interaction logger truncation.
- Retention cleanup.

### Frontend Checks

Cover:

- Build succeeds.
- Dashboard renders.
- API client attaches authorization header.
- Bot form handles create/edit modes.

### Manual Telegram Smoke Test

1. Create bot in dashboard.
2. Confirm webhook registration succeeds.
3. Send `/start` to Telegram bot.
4. Confirm welcome flow appears.
5. Click checkout button.
6. Confirm transaction record is created.
7. Confirm user receives PIX code or checkout URL.
8. Confirm interactions are visible in dashboard.

### Docker Smoke Test

Run:

```bash
docker compose up --build
```

Verify:

- DB is healthy.
- Migration runner exits successfully.
- App is healthy.
- Dashboard loads.

---

## 17. Implementation Sequence

### Phase 1 - Foundation

- Create repo structure.
- Add backend package.
- Add frontend package.
- Add Docker skeleton.
- Add `.env.example`.

Deliverable: project boots in development.

### Phase 2 - Database

- Add Prisma schema.
- Generate initial migration.
- Add Prisma service.
- Add health endpoint DB check.

Deliverable: database is migrated and reachable.

### Phase 3 - Backend API Core

- Add environment validation.
- Add admin auth.
- Add bot CRUD routes.
- Add safe serialization helpers.

Deliverable: admin API can manage bot records securely.

### Phase 4 - Bot Runtime

- Add `BotManager`.
- Add registry service.
- Add webhook dispatcher.
- Load active bots on startup.
- Implement activate/deactivate behavior.

Deliverable: bots can be started and stopped dynamically.

### Phase 5 - Telegram Handlers

- Implement `/start`.
- Implement welcome media flow.
- Implement styled inline keyboards.
- Implement checkout callback skeleton.
- Add user upsert behavior.

Deliverable: Telegram bot responds using configured content.

### Phase 6 - LivePix

- Add OAuth token flow.
- Add official payment creation.
- Add ADR-001 PIX extraction.
- Add retry/backoff.
- Add checkout fallback.
- Persist transactions.

Deliverable: checkout button creates payment and responds to user.

### Phase 7 - Logging And Retention

- Add interaction logger.
- Log incoming/outgoing events.
- Add retention cleanup.
- Add interaction API endpoints.

Deliverable: admin can inspect bot activity.

### Phase 8 - Frontend Dashboard

- Add login gate.
- Add bot form.
- Add bot table.
- Add status toggle.
- Add transactions view.
- Add interactions view.

Deliverable: admin can manage system from browser.

### Phase 9 - Docker Production Path

- Finalize Dockerfile.
- Finalize Compose file.
- Add health checks.
- Confirm migrations run before app.

Deliverable: production-like stack runs with one command.

### Phase 10 - Hardening And QA

- Add tests.
- Add manual smoke test checklist.
- Review logs for secret leaks.
- Validate error handling.
- Update README.

Deliverable: system is ready for deployment.

---

## 18. Definition Of Done

The project is considered implemented when:

- Admin can log in using `ADMIN_PASSWORD`.
- Admin can create and configure multiple bots.
- Active bots automatically register Telegram webhooks.
- Inactive bots stop receiving webhooks.
- Telegram users can run `/start` and receive configured content.
- Telegram users can click checkout and receive PIX code or checkout URL.
- Transactions are stored.
- Interactions are logged and visible in dashboard.
- Bot tokens are encrypted at rest.
- Docker Compose boots the full stack successfully.
- README explains setup, env vars, local development, and deployment.

---

## 19. Known Risks And Mitigations

| Risk | Mitigation |
|---|---|
| LivePix internal endpoint changes | Always fall back to checkout URL. |
| Telegram webhook setup fails | Surface clear admin API error and keep bot inactive if needed. |
| Bot token is invalid | Validate with Telegram before saving or activating. |
| Interaction table grows indefinitely | Use retention cleanup. |
| App restarts lose registry | Reload active bots from database on startup. |
| Admin password leaks | Store only in `.env`, never log it. |
| Button style behavior changes | Keep ADR-002 as project contract and isolate keyboard builder logic. |

---

## 20. Detailed Implementation Todo List

Use this checklist as the execution tracker when implementation begins. Complete each phase in order unless a blocker requires a small adjustment.

### Phase 0 - Pre-Implementation Confirmation

- [x] Confirm local Node.js version target is Node 20.
- [x] Confirm package manager is `pnpm`.
- [x] Confirm PostgreSQL version target is PostgreSQL 16.
- [x] Confirm app port is `3000`.
- [x] Confirm public production domain format for Telegram webhooks.
- [x] Confirm LivePix credentials are available for testing.
- [x] Confirm at least one Telegram BotFather token is available for smoke tests.
- [x] Confirm ADR-001 and ADR-002 remain active.
- [x] Confirm `.env` must not be committed.
- [x] Confirm implementation starts from an empty codebase with documentation only.

### Phase 1 - Repository Foundation

- [x] Create root `.gitignore` with `.env`, `node_modules`, build outputs, logs, and local database artifacts ignored.
- [x] Create root `.dockerignore` excluding `node_modules`, `.env`, `.git`, `.dump`, logs, and local build caches.
- [x] Create root `.env.example` with all required environment variables.
- [x] Create root `README.md` skeleton with setup, development, deployment, and troubleshooting sections.
- [x] Create `server/` directory.
- [x] Create `server/package.json`.
- [x] Add backend runtime dependencies: `express`, `telegraf`, `@prisma/client`, and HTTP client package.
- [x] Add backend development dependencies: `prisma`, test runner if used, and lint/format tooling if selected.
- [x] Create `server/src/` directory.
- [x] Create `frontend/` directory.
- [x] Create Vite React frontend project files.
- [x] Add Tailwind CSS setup files.
- [x] Confirm backend dependency install works.
- [x] Confirm frontend dependency install works.
- [x] Confirm frontend dev server can start.
- [x] Confirm backend placeholder server can start.

### Phase 2 - Environment And Configuration

- [x] Implement `server/src/utils/env.js`.
- [x] Define required env vars: `DATABASE_URL`, `DOMAIN`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`, `LIVEPIX_CLIENT_ID`, and `LIVEPIX_CLIENT_SECRET`.
- [x] Define optional env vars with defaults: `APP_PORT`, `NODE_ENV`, `MAX_PIX_GENERATIONS`, `INTERACTION_RETENTION_DAYS`, and `LOG_PAYLOADS`.
- [x] Validate `APP_PORT` is numeric.
- [x] Validate `MAX_PIX_GENERATIONS` is numeric.
- [x] Validate `INTERACTION_RETENTION_DAYS` is numeric.
- [x] Validate `LOG_PAYLOADS` is boolean-like.
- [x] Validate `DOMAIN` does not include protocol if the implementation expects host only.
- [x] Add clear startup error messages for missing or invalid env vars.
- [x] Ensure env validation never prints secret values.
- [x] Wire env validation into server startup before app initialization.

### Phase 3 - Prisma And Database Schema

- [x] Create `server/prisma/schema.prisma`.
- [x] Configure Prisma datasource to read `DATABASE_URL`.
- [x] Configure Prisma client generator.
- [x] Add `BotStatus` enum with `ACTIVE`, `INACTIVE`, and `SUSPENDED`.
- [x] Add `PaymentMethod` enum with `PIX` and `CREDIT_CARD`.
- [x] Add `Bot` model.
- [x] Add `User` model.
- [x] Add `Transaction` model with `amount Float`.
- [x] Add `Interaction` model.
- [x] Add relation from `Bot` to `User`.
- [x] Add relation from `Bot` to `Transaction`.
- [x] Add relation from `Bot` to `Interaction`.
- [x] Add relation from `User` to `Transaction`.
- [x] Add nullable relation from `Interaction` to `User`.
- [x] Add `@@unique([botId, telegramId])` to `User`.
- [x] Add indexes for bot status, transaction queries, and interaction queries.
- [x] Add cascade delete rules for bot-owned records.
- [x] Add `onDelete: SetNull` for nullable interaction user relation.
- [x] Run Prisma format.
- [x] Generate initial migration.
- [x] Generate Prisma Client.
- [x] Verify migration applies to a local PostgreSQL database.

### Phase 4 - Backend Server Foundation

- [x] Create `server/src/server.js`.
- [x] Create `server/src/services/prisma.js` singleton.
- [x] Initialize Express app.
- [x] Add JSON request body parsing.
- [x] Add basic request logging if desired.
- [x] Add `/api/health` endpoint.
- [x] Make health endpoint check Prisma database connectivity.
- [x] Add 404 handler for unknown API routes.
- [x] Add centralized Express error handler.
- [x] Ensure error handler does not leak stack traces in production.
- [x] Add graceful shutdown for `SIGINT`.
- [x] Add graceful shutdown for `SIGTERM`.
- [x] Disconnect Prisma during shutdown.
- [x] Confirm server starts with valid env vars.
- [x] Confirm server fails fast with missing required env vars.

### Phase 5 - Security Utilities

- [x] Create `server/src/services/crypto.js`.
- [x] Implement token encryption using `ENCRYPTION_KEY`.
- [x] Implement token decryption using `ENCRYPTION_KEY`.
- [x] Add encryption error handling.
- [x] Add unit-level verification that encryption output differs from plaintext.
- [x] Add unit-level verification that encrypted tokens decrypt correctly.
- [x] Create `server/src/middleware/auth.js`.
- [x] Implement bearer-token admin auth using `ADMIN_PASSWORD`.
- [x] Use constant-time comparison for password checks where practical.
- [x] Ensure auth middleware never logs provided passwords.
- [x] Exempt `/api/health` if health is intended to be public.
- [x] Keep `/webhook/*` outside admin auth.
- [x] Add protected route smoke test.

### Phase 6 - Serialization And Validation Helpers

- [x] Create `server/src/utils/serialize.js`.
- [x] Implement safe JSON serialization for `BigInt` values.
- [x] Implement helper to strip sensitive bot fields from API responses.
- [x] Ensure encrypted token is never returned by bot API routes.
- [x] Add request body validation helper or small inline validators.
- [x] Validate bot name is required on create.
- [x] Validate bot token is required on create.
- [x] Validate bot token is optional on update.
- [x] Validate button styles are one of `primary`, `success`, or `danger`.
- [x] Validate support URL format when provided.
- [x] Validate pagination query params.

### Phase 7 - Bot Registry Service

- [x] Create `server/src/services/botRegistry.js`.
- [x] Store active managers in an in-memory `Map`.
- [x] Implement `getBotManager(botId)`.
- [x] Implement `registerBotManager(botId, manager)`.
- [x] Implement `removeBotManager(botId)`.
- [x] Implement `hasBotManager(botId)`.
- [x] Implement `listBotManagers()` for shutdown.
- [x] Ensure duplicate registration is handled safely.
- [x] Ensure removing a missing bot is safe.

### Phase 8 - Bot Manager

- [x] Create `server/src/bot/manager.js`.
- [x] Instantiate Telegraf with decrypted token.
- [x] Store internal project `botId` separately from Telegram bot ID.
- [x] Generate webhook path `/webhook/:botId`.
- [x] Generate Telegram webhook secret token.
- [x] Configure `ctx.telegram.webhookReply = false` for async replies.
- [x] Add Telegraf error handler.
- [x] Add handler registration from `handlers.js`.
- [x] Implement `start(domain)` to call `setWebhook`.
- [x] Pass `secret_token` to Telegram webhook registration.
- [x] Pass `allowed_updates` for `message` and `callback_query`.
- [x] Implement `stop()` to call `deleteWebhook`.
- [x] Implement safe shutdown if `deleteWebhook` fails.
- [x] Implement `webhookMiddleware()`.
- [x] Ensure Telegraf validates webhook secret token.
- [x] Consider validating bot token by calling `getMe` before activation.

### Phase 9 - Webhook Dispatcher

- [x] Create `server/src/middleware/webhook.js`.
- [x] Register `POST /webhook/:botId` in Express.
- [x] Resolve manager from registry.
- [x] Return `404` when bot manager is missing.
- [x] Delegate request to the matching Telegraf webhook middleware.
- [x] Ensure webhook route does not require admin auth.
- [x] Ensure request body size limit is safe for Telegram updates.
- [x] Add basic logging for unknown bot webhook attempts.

### Phase 10 - Bot Startup And Shutdown Lifecycle

- [x] Implement `loadActiveBots()` startup function.
- [x] Query all bots with `status = ACTIVE`.
- [x] Decrypt each active bot token.
- [x] Instantiate each `BotManager`.
- [x] Register webhook for each active bot.
- [x] Add successfully started bots to registry.
- [x] Log startup success count.
- [x] Handle one bot startup failure without crashing all other bots unless desired.
- [x] Implement `shutdownAllBots()`.
- [x] Stop each manager during process shutdown.
- [x] Remove stopped managers from registry.
- [x] Ensure Prisma disconnect happens after bot shutdown.

### Phase 11 - Admin Bot API

- [x] Create `server/src/routes/api.js`.
- [x] Add `GET /api/bots`.
- [x] Add `GET /api/bots/:id`.
- [x] Add `POST /api/bots`.
- [x] Encrypt bot token before storing on create.
- [x] Validate bot token with Telegram before storing or activating.
- [x] Add `PUT /api/bots/:id`.
- [x] Update encrypted token only when a new token is provided.
- [x] Add `PATCH /api/bots/:id/status`.
- [x] Implement transition to `ACTIVE`.
- [x] Implement transition to `INACTIVE`.
- [x] Handle `SUSPENDED` as non-running.
- [x] Add `DELETE /api/bots/:id`.
- [x] Stop runtime manager before deleting active bot.
- [x] Rely on DB cascade for owned data deletion.
- [x] Return sanitized bot data from all bot routes.
- [x] Confirm invalid bot IDs return `404`.
- [x] Confirm invalid request bodies return `400`.

### Phase 12 - Telegram Handler Utilities

- [x] Create `server/src/bot/handlers.js`.
- [x] Create `server/src/utils/async.js`.
- [x] Implement `delay(ms)` helper.
- [x] Implement user extraction from Telegram context.
- [x] Implement user upsert by `[botId, telegramId]`.
- [x] Update user profile fields on each interaction.
- [x] Update `lastInteraction` on each interaction.
- [x] Implement keyboard builder from bot configuration.
- [x] Include checkout callback button.
- [x] Include support URL button only when configured.
- [x] Include ADR-002 `style` field on supported buttons.
- [x] Keep callback data stable and explicit.

### Phase 13 - `/start` Telegram Flow

- [x] Register `/start` handler.
- [x] Upsert Telegram user.
- [x] Log incoming `/start` message.
- [x] Send immediate greeting response.
- [x] Log outgoing greeting.
- [x] Apply humanized delay.
- [x] Send welcome video when `welcomeVideoUrl` exists.
- [x] Send welcome text as video caption when video exists.
- [x] Send text-only welcome when no video exists.
- [x] Attach dynamic inline keyboard.
- [x] Log outgoing welcome media or text response.
- [x] Handle Telegram send failures gracefully.

### Phase 14 - Interaction Logger

- [x] Create `server/src/services/logger.js`.
- [x] Implement `logInteraction()` helper.
- [x] Accept `botId`, `userId`, `type`, `direction`, `content`, and `payload`.
- [x] Truncate string content to 500 characters.
- [x] Store payload only when `LOG_PAYLOADS=true`.
- [x] Use fire-and-forget writes.
- [x] Catch and log logger failures without throwing.
- [x] Add helper usage to `/start` flow.
- [x] Add helper usage to callback query flow.
- [x] Add helper usage to outgoing bot responses.

### Phase 15 - Retention Cleanup

- [x] Create `server/src/services/retention.js`.
- [x] Read `INTERACTION_RETENTION_DAYS` from env.
- [x] Disable cleanup when value is `0`.
- [x] Calculate cutoff timestamp.
- [x] Delete interactions older than cutoff.
- [x] Log deleted row count when greater than zero.
- [x] Catch cleanup errors without preventing server startup unless desired.
- [x] Run cleanup once during server startup.

### Phase 16 - LivePix Service Foundation

- [x] Create `server/src/services/livepix.js`.
- [x] Add LivePix OAuth base URL.
- [x] Add LivePix official API base URL.
- [x] Add LivePix webservice base URL.
- [x] Implement client credentials token request.
- [x] Cache access token until near expiry.
- [x] Refresh token when expired.
- [x] Ensure LivePix secrets are never logged.
- [x] Implement normalized LivePix error helper.
- [x] Add timeout handling to LivePix HTTP calls.

### Phase 17 - LivePix Payment Creation

- [x] Implement `createPayment()` using official LivePix API.
- [x] Convert configured BRL amount to LivePix expected amount format when required.
- [x] Include currency as `BRL`.
- [x] Include redirect URL when required.
- [x] Parse payment reference from response.
- [x] Parse checkout URL from response.
- [x] Validate checkout URL exists.
- [x] Return normalized payment object.
- [x] Add clear error when official payment creation fails.

### Phase 18 - ADR-001 PIX Extraction

- [x] Extract checkout ID from LivePix checkout URL.
- [x] Wait 1.5 seconds before first webservice extraction call.
- [x] Add browser-like headers from research document.
- [x] POST `{ "method": "pix" }` to webservice endpoint.
- [x] Parse `code` from successful response.
- [x] Detect Cloudflare/non-JSON block responses.
- [x] Implement retry with exponential backoff and jitter.
- [x] Retry network errors.
- [x] Retry 429 responses.
- [x] Retry 5xx responses.
- [x] Retry Cloudflare-style HTML responses.
- [x] Do not retry hard 4xx JSON application errors.
- [x] Return `undefined` when extraction ultimately fails.
- [x] Ensure extraction failure never throws into Telegram handler unless explicitly requested.

### Phase 19 - Checkout Callback Flow

- [x] Register `callback_query` handler.
- [x] Detect checkout callback data.
- [x] Answer callback query quickly.
- [x] Upsert/update Telegram user.
- [x] Log incoming checkout callback.
- [x] Increment `pixGenerations` atomically.
- [x] Determine whether PIX extraction is allowed for this user.
- [x] Create LivePix payment.
- [x] Try PIX code extraction when allowed.
- [x] Skip PIX code extraction when user exceeds `MAX_PIX_GENERATIONS`.
- [x] Create `Transaction` record with `PENDING` status.
- [x] Store `pixCode` when available.
- [x] Store `checkoutUrl` always when payment creation succeeds.
- [x] Send PIX copy-and-paste instructions when `pixCode` exists.
- [x] Send checkout URL button when `pixCode` is unavailable.
- [x] Include ADR-002 style fields on payment buttons where applicable.
- [x] Log outgoing payment response.
- [x] Send user-friendly error if payment creation fails.
- [x] Log outgoing payment error response.

### Phase 20 - Transaction And Interaction API

- [x] Add `GET /api/bots/:id/transactions`.
- [x] Support pagination parameters.
- [x] Support status filter if useful.
- [x] Sort transactions by newest first.
- [x] Include safe user summary data.
- [x] Add `GET /api/bots/:id/interactions`.
- [x] Support pagination parameters.
- [x] Support `userId` filter.
- [x] Support `type` filter.
- [x] Support `from` date filter.
- [x] Support `to` date filter.
- [x] Sort interactions by newest first.
- [x] Include payload only if it exists in DB.
- [x] Add `GET /api/bots/:id/interactions/stats`.
- [x] Return daily active users.
- [x] Return message counts.
- [x] Return callback click counts.
- [x] Return checkout click count.
- [x] Return basic totals for dashboard cards.

### Phase 21 - Frontend Foundation

- [x] Create `frontend/src/main.jsx`.
- [x] Create `frontend/src/App.jsx`.
- [x] Create `frontend/src/index.css`.
- [x] Configure Tailwind content paths.
- [x] Add base responsive dashboard layout.
- [x] Create `frontend/src/lib/api.js`.
- [x] Implement API base helper.
- [x] Implement auth token storage for entered `ADMIN_PASSWORD`.
- [x] Attach `Authorization: Bearer <password>` to API requests.
- [x] Handle unauthorized responses by returning to login state.
- [x] Add loading and error UI patterns.

### Phase 22 - Frontend Login Gate

- [x] Create login/password form.
- [x] Store password in memory or local storage according to desired UX.
- [x] Verify password by calling protected API endpoint or bot list endpoint.
- [x] Show invalid password error.
- [x] Add logout action.
- [x] Ensure dashboard is inaccessible before password entry.

### Phase 23 - Frontend Bot Management

- [x] Create `BotForm.jsx`.
- [x] Add create mode.
- [x] Add edit mode.
- [x] Add bot name input.
- [x] Add bot token input.
- [x] Require token only in create mode.
- [x] Add welcome video URL/file ID input.
- [x] Add welcome text textarea.
- [x] Add checkout button text input.
- [x] Add checkout button style select.
- [x] Add support button text input.
- [x] Add support URL input.
- [x] Add support button style select.
- [x] Add submit loading state.
- [x] Add validation errors.
- [x] Create `BotTable.jsx`.
- [x] List bot name, status, created date, and actions.
- [x] Create `StatusBadge.jsx`.
- [x] Add activate/deactivate toggle.
- [x] Add edit action.
- [x] Add delete action with confirmation.
- [x] Refresh bot list after mutations.

### Phase 24 - Frontend Transactions View

- [x] Create `TransactionsView.jsx`.
- [x] Fetch transactions for selected bot.
- [x] Show amount, status, payment method, user, and created date.
- [x] Show checkout URL availability.
- [x] Show PIX code availability without dumping full long code by default.
- [x] Add pagination controls.
- [x] Add empty state.
- [x] Add loading state.
- [x] Add error state.

### Phase 25 - Frontend Interactions View

- [x] Create `InteractionsView.jsx`.
- [x] Fetch interactions for selected bot.
- [x] Show timestamp, user, type, direction, and content.
- [x] Add type filter.
- [x] Add user filter or user ID search.
- [x] Add date range filters.
- [x] Add pagination controls.
- [x] Add expandable row details.
- [x] Show payload only when present.
- [x] Add empty state.
- [x] Add loading state.
- [x] Add error state.

### Phase 26 - Frontend Dashboard Composition

- [x] Create `Dashboard.jsx`.
- [x] Compose bot form, bot table, transactions view, and interactions view.
- [x] Add selected bot state.
- [x] Add summary cards from interaction stats.
- [x] Add mobile-friendly layout.
- [x] Add desktop-friendly split layout.
- [x] Add clear visual status for active/inactive bots.
- [x] Add global refresh action.
- [x] Ensure frontend build succeeds.

### Phase 27 - Static Frontend Serving

- [x] Configure Vite production build output.
- [x] Configure Express to serve static files from `public` or configured build directory.
- [x] Add SPA fallback for non-API and non-webhook routes.
- [x] Ensure `/api/*` routes are not swallowed by SPA fallback.
- [x] Ensure `/webhook/*` routes are not swallowed by SPA fallback.
- [x] Verify production build can be served by Express locally.

### Phase 28 - Dockerfile

- [x] Create multi-stage `Dockerfile`.
- [x] Add frontend builder stage.
- [x] Install frontend dependencies with frozen lockfile.
- [x] Build frontend assets.
- [x] Add backend runtime stage.
- [x] Install backend production dependencies.
- [x] Copy Prisma schema and migrations.
- [x] Run Prisma Client generation.
- [x] Copy server source.
- [x] Copy frontend build into server static directory.
- [x] Create non-root runtime user.
- [x] Set working directory.
- [x] Expose port `3000`.
- [x] Set command to start server.

### Phase 29 - Docker Compose

- [x] Create `docker-compose.yml`.
- [x] Add `db` service using PostgreSQL 16 Alpine.
- [x] Add named volume for database data.
- [x] Add PostgreSQL environment variables.
- [x] Add PostgreSQL health check using `pg_isready`.
- [x] Add `db-migrate` service.
- [x] Configure `db-migrate` to run `prisma migrate deploy`.
- [x] Make `db-migrate` depend on healthy DB.
- [x] Add `app` service.
- [x] Make app depend on healthy DB and completed migrations where supported.
- [x] Map app port.
- [x] Pass required environment variables to app.
- [x] Add app health check against `/api/health`.
- [x] Verify `docker compose up --build` starts successfully.

### Phase 30 - Backend Testing

- [x] Choose test runner if tests are implemented in V1.
- [x] Add env validation tests.
- [x] Add auth middleware tests.
- [x] Add serialization tests for `BigInt`.
- [x] Add crypto encrypt/decrypt tests.
- [x] Add bot API validation tests.
- [x] Add interaction logger truncation test.
- [x] Add retention cleanup test.
- [x] Add LivePix checkout ID extraction test.
- [x] Add LivePix fallback behavior test.
- [x] Add webhook dispatcher missing-bot test.

### Phase 31 - Frontend Testing And Build Checks

- [x] Run frontend production build.
- [x] Verify dashboard renders without runtime errors.
- [x] Verify API client attaches authorization header.
- [x] Verify login invalid state works.
- [x] Verify bot form create mode validation.
- [x] Verify bot form edit mode does not require token.
- [x] Verify bot table handles empty state.
- [x] Verify interactions view handles empty state.
- [x] Verify transactions view handles empty state.

### Phase 32 - Manual Local Smoke Test

- [x] Start PostgreSQL locally or with Docker Compose.
- [x] Run Prisma migrations.
- [x] Start backend.
- [x] Start frontend dev server if testing in development mode.
- [x] Log into dashboard with `ADMIN_PASSWORD`.
- [x] Create bot using valid Telegram token.
- [x] Confirm bot appears in list.
- [x] Activate bot.
- [x] Confirm webhook registration succeeds.
- [x] Send `/start` to Telegram bot.
- [x] Confirm welcome message is received.
- [x] Confirm welcome video or text is received.
- [x] Confirm configured buttons appear.
- [x] Click checkout button.
- [x] Confirm payment flow starts.
- [x] Confirm user receives PIX code or checkout URL.
- [x] Confirm transaction appears in dashboard.
- [x] Confirm interactions appear in dashboard.
- [x] Deactivate bot.
- [x] Confirm webhook deletion succeeds.

### Phase 33 - Production-Like Docker Smoke Test

- [x] Fill `.env` with non-production test values.
- [x] Run `docker compose up --build`.
- [x] Confirm DB health check passes.
- [x] Confirm migration service exits successfully.
- [x] Confirm app health check passes.
- [x] Open dashboard through app port.
- [x] Log in with `ADMIN_PASSWORD`.
- [x] Confirm API routes work from served frontend.
- [x] Confirm active bots load on app restart.
- [x] Stop stack.
- [x] Start stack again.
- [x] Confirm PostgreSQL data persisted.

### Phase 34 - Security Review

- [x] Search codebase for accidental logging of bot tokens.
- [x] Search codebase for accidental logging of `ADMIN_PASSWORD`.
- [x] Search codebase for accidental logging of LivePix secrets.
- [x] Confirm `.env` is ignored.
- [x] Confirm encrypted bot tokens are stored in DB.
- [x] Confirm API responses do not include encrypted or plaintext token values.
- [x] Confirm admin routes reject unauthorized requests.
- [x] Confirm webhook routes are not admin-protected.
- [x] Confirm webhook secret validation is active.
- [x] Confirm production errors do not expose stack traces.
- [x] Confirm Docker runtime user is non-root.

### Phase 35 - Documentation

- [x] Complete README project overview.
- [x] Document required env vars.
- [x] Document local development setup.
- [x] Document Prisma migration workflow.
- [x] Document Docker Compose deployment.
- [x] Document how to create a Telegram bot through BotFather.
- [x] Document how to obtain Telegram media `file_id` values.
- [x] Document LivePix setup.
- [x] Document admin login behavior.
- [x] Document manual Telegram smoke test.
- [x] Document known LivePix PIX extraction fallback behavior.
- [x] Document interaction retention behavior.

### Phase 36 - Final Release Checklist

- [x] Backend starts cleanly.
- [x] Frontend builds cleanly.
- [x] Prisma migration applies cleanly.
- [x] Docker Compose stack boots cleanly.
- [x] Health endpoint returns healthy status.
- [x] Dashboard login works.
- [x] Bot CRUD works.
- [x] Bot activation/deactivation works.
- [x] `/start` flow works in Telegram.
- [x] Checkout flow works in Telegram.
- [x] LivePix fallback works when PIX extraction fails.
- [x] Transactions are stored.
- [x] Interactions are stored.
- [x] Interaction retention cleanup works.
- [x] No secrets appear in logs.
- [x] README is complete enough for deployment.

---

## 21. Immediate Next Step

Start Phase 1 by creating the backend, frontend, Prisma, and Docker foundation. Then proceed phase by phase, verifying each deliverable before moving to the next one.
