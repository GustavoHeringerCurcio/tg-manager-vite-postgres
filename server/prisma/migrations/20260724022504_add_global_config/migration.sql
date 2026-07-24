-- CreateTable
CREATE TABLE "global_config" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_config_pkey" PRIMARY KEY ("id")
);
