-- AlterTable
ALTER TABLE "bots" ADD COLUMN "remarketing" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "remarketing_states" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nextIndex" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remarketing_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "remarketing_states_userId_botId_key" ON "remarketing_states"("userId", "botId");

-- CreateIndex
CREATE INDEX "remarketing_states_botId_nextSendAt_idx" ON "remarketing_states"("botId", "nextSendAt");

-- AddForeignKey
ALTER TABLE "remarketing_states" ADD CONSTRAINT "remarketing_states_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remarketing_states" ADD CONSTRAINT "remarketing_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
