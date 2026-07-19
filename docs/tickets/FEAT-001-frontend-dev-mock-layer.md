# FEAT-001: Frontend Dev Mock API Layer

**Title** — Frontend Dev Mock API Layer

**Goal** — Enable local frontend development without requiring the full backend stack
(PostgreSQL, Docker, Telegram webhooks, LivePix). Developers can run only the Vite dev
server, create/delete bots in-memory, and see UI changes in real time — no push-to-VPS
cycle needed.

**Background** — 

Currently, the frontend Vite dev server proxies `/api` to `http://localhost:3000` (the
Express backend). The backend requires:

- PostgreSQL running via Docker Compose
- Valid Telegram bot tokens for webhook registration
- A public HTTPS domain (or localhost bypass that still needs the DB)
- AES-256-GCM encryption key
- LivePix OAuth credentials

Without all of these running locally, the frontend cannot function at all. Developers
must push changes to a VPS and test in production, which is slow and risky.

The server already has a localhost detection pattern in `POST /api/bots` (line 112-118 of
`server/src/routes/api.ts`) that skips Telegram webhook registration when `DOMAIN` is
localhost. But this still requires the full backend running with PostgreSQL. A true
frontend-only dev mode needs no backend at all.

Affected packages: `@botflix/frontend` only.

**Scope** —

In scope:
- Vite dev-mode plugin that intercepts all `/api/*` HTTP requests in `configureServer`
- In-memory `Map`-based bot store (persists across HMR, resets on Vite restart)
- Mock handlers for all bot CRUD: `GET/POST/PUT/DELETE /api/bots`, `PATCH /api/bots/:id/status`
- Stub handlers returning empty/fixture data for `GET /api/bots/:id/transactions`, `GET /api/bots/:id/interactions`, `GET /api/bots/:id/interactions/stats`
- Auth bypass: any password accepted
- Toggled via `VITE_DEV_MODE=true` environment variable
- `.env.example` (or `.env.development`) documentation for the new variable

Out of scope:
- LivePix payment simulation
- Telegram webhook simulation
- Remarketing scheduler simulation
- Database persistence (by design — in-memory resets on Vite restart for clean state)
- Transaction/interaction fixture data (returns empty lists)
- Changes to the server package
- Production bundle impact (mock code is only imported in `vite.config.ts`, never in browser code)

**Deliverable** —

1. `frontend/mockDevServer.ts` — In-memory bot store, request router, and all mock API
   handlers. Exports a single `mockRequest(req, res): Promise<boolean>` function that
   returns `true` if the request was handled.
2. `frontend/vite.config.ts` — Updated to include a `devMockPlugin()` Vite plugin that
   calls `mockRequest` in `configureServer` middleware, and conditionally disables the
   `/api` proxy when `VITE_DEV_MODE=true`.
3. `frontend/.env.development` — Documents `VITE_DEV_MODE=true` and its purpose.
4. This ticket file — `docs/tickets/FEAT-001-frontend-dev-mock-layer.md`.
