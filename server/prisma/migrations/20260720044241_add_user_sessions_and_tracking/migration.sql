-- AlterTable
ALTER TABLE "bots" ALTER COLUMN "paymentFlow" SET DEFAULT '{}',
ALTER COLUMN "paymentFlow" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "buttonId" TEXT,
ADD COLUMN     "chatId" BIGINT,
ADD COLUMN     "messageId" BIGINT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "stepIndex" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentSessionId" TEXT,
ADD COLUMN     "currentStepIndex" INTEGER,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalInteractions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPayments" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentStepIndex" INTEGER,
    "stepsCompleted" JSONB NOT NULL DEFAULT '[]',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sessions_botId_userId_idx" ON "user_sessions"("botId", "userId");

-- CreateIndex
CREATE INDEX "user_sessions_botId_status_idx" ON "user_sessions"("botId", "status");

-- CreateIndex
CREATE INDEX "user_sessions_botId_startedAt_idx" ON "user_sessions"("botId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "interactions_sessionId_createdAt_idx" ON "interactions"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "user_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
