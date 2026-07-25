-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "utmifyApiToken" TEXT,
ADD COLUMN     "utmifyEnabled" BOOLEAN NOT NULL DEFAULT false;
