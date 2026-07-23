import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(rootDir, ".env.test") });
config({ path: resolve(rootDir, "server", ".env") });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const botId = process.env.TEST_BOT_ID || "test-bot-load";

  console.log(`[reset-test-db] Clearing test data for bot "${botId}"...`);

  await prisma.pixelEvent.deleteMany({ where: { botId } });
  await prisma.remarketingState.deleteMany({ where: { botId } });
  await prisma.interaction.deleteMany({ where: { botId } });
  await prisma.transaction.deleteMany({ where: { botId } });
  await prisma.userSession.deleteMany({ where: { botId } });
  await prisma.user.deleteMany({ where: { botId } });

  console.log(`[reset-test-db] All test data cleared for bot "${botId}".`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("[reset-test-db] Fatal error:", error);
  process.exit(1);
});
