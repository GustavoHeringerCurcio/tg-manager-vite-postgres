CREATE TYPE "BotStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD');

CREATE TABLE "bots" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "welcomeVideoUrl" TEXT,
  "welcomeText" TEXT,
  "checkoutButtonText" TEXT NOT NULL DEFAULT 'Pagar agora',
  "checkoutButtonStyle" TEXT NOT NULL DEFAULT 'primary',
  "supportButtonText" TEXT NOT NULL DEFAULT 'Suporte',
  "supportButtonStyle" TEXT NOT NULL DEFAULT 'primary',
  "supportUrl" TEXT,
  "checkoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 29.9,
  "status" "BotStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "telegramId" BIGINT NOT NULL,
  "username" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "pixGenerations" INTEGER NOT NULL DEFAULT 0,
  "lastInteraction" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "pixCode" TEXT,
  "checkoutUrl" TEXT,
  "livepixReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interactions" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "content" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_botId_telegramId_key" ON "users"("botId", "telegramId");
CREATE INDEX "bots_status_idx" ON "bots"("status");
CREATE INDEX "users_botId_idx" ON "users"("botId");
CREATE INDEX "transactions_botId_status_idx" ON "transactions"("botId", "status");
CREATE INDEX "transactions_botId_createdAt_idx" ON "transactions"("botId", "createdAt");
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");
CREATE INDEX "interactions_botId_createdAt_idx" ON "interactions"("botId", "createdAt");
CREATE INDEX "interactions_userId_createdAt_idx" ON "interactions"("userId", "createdAt");
CREATE INDEX "interactions_createdAt_idx" ON "interactions"("createdAt");

ALTER TABLE "users" ADD CONSTRAINT "users_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
