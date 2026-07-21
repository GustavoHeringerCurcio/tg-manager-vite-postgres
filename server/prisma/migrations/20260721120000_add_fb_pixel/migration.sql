ALTER TABLE "bots" ADD COLUMN "fbPixelId" TEXT;
ALTER TABLE "bots" ADD COLUMN "fbAccessToken" TEXT;

CREATE TABLE "pixel_events" (
  "id" TEXT NOT NULL,
  "botId" TEXT NOT NULL,
  "userId" TEXT,
  "eventName" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "customData" JSONB,
  "success" BOOLEAN NOT NULL,
  "statusCode" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pixel_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pixel_events_botId_createdAt_idx" ON "pixel_events"("botId", "createdAt");
CREATE INDEX "pixel_events_botId_eventName_createdAt_idx" ON "pixel_events"("botId", "eventName", "createdAt");

ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
