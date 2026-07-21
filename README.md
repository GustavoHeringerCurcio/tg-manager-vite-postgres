# tg-manager-vite-postgres

Single-admin platform for managing multiple Telegram bots that create LivePix PIX payments.

## Requirements

- Node.js 20+
- pnpm via Corepack
- PostgreSQL 16
- Docker and Docker Compose for production-like runs

## Environment

Copy `.env.example` to `.env` and set real values. Keep `.env` private.

Required variables: `DATABASE_URL`, `DOMAIN`, `ADMIN_PASSWORD`, `LIVEPIX_CLIENT_ID`, `LIVEPIX_CLIENT_SECRET`.

`DOMAIN` must be a host only, for example `botflix.example.com`, because Telegram webhook URLs are registered as `https://DOMAIN/webhook/:botId`.

## Development

```bash
corepack enable
pnpm install
pnpm prisma:generate
pnpm --filter @botflix/server prisma:migrate
pnpm dev:server
pnpm dev:frontend
```

The frontend dev server proxies API calls to the backend. In production, Express serves the compiled dashboard from `server/public`.

## Database

Prisma schema lives in `server/prisma/schema.prisma`.

Development migration workflow:

```bash
pnpm --filter @botflix/server prisma:migrate
```

Production migration workflow:

```bash
pnpm --filter @botflix/server prisma:deploy
```

## Docker Compose

```bash
docker compose up --build
```

## Updates
```bash
git pull 
sudo docker compose --file docker-compose.yml --file docker-compose.easypanel.yml up --detach --build
```

Services:

- `db`: PostgreSQL 16 with persistent `pgdata` volume.
- `db-migrate`: one-shot Prisma migration runner.
- `app`: Express API, Telegram webhooks, and static dashboard.

## Telegram Setup

1. Create a bot with BotFather.
2. Copy the bot token into the dashboard when creating a bot.
3. Upload welcome media to Telegram and capture its `file_id` from Telegram API responses if you want fast reusable media.
4. Activate the bot. The backend registers `https://DOMAIN/webhook/:botId` with Telegram and validates Telegram webhook secret headers.

## LivePix

The checkout flow creates a payment through the official LivePix API. It then attempts the ADR-001 PIX code extraction endpoint after a short propagation delay. If extraction fails, users receive the LivePix checkout URL instead.

## Admin Login

The dashboard asks for the admin password and sends it as `Authorization: Bearer <ADMIN_PASSWORD>`. `/api/health` is public; all other `/api/*` routes require the bearer token.

## Retention

`INTERACTION_RETENTION_DAYS` controls startup cleanup of old interaction rows. Use `0` to disable cleanup.

## Smoke Test

1. Start PostgreSQL and run migrations.
2. Start backend and dashboard.
3. Log in with `ADMIN_PASSWORD`.
4. Create a bot with a valid BotFather token.
5. Activate it and confirm Telegram webhook registration succeeds.
6. Send `/start` to the bot.
7. Confirm configured welcome content and buttons appear.
8. Click checkout.
9. Confirm the user receives a PIX code or LivePix checkout URL.
10. Confirm transactions and interactions appear in the dashboard.

## Security Notes

- API responses never include bot token values.
- Secrets are not logged.
- Docker runtime uses a non-root user.
