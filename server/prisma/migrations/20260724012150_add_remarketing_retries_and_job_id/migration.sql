-- AlterTable
ALTER TABLE "remarketing_states" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "pgBossJobId" TEXT,
ADD COLUMN     "retries" INTEGER NOT NULL DEFAULT 0;
