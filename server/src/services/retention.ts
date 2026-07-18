import { prisma } from "./prisma.js";

export async function cleanupOldInteractions(retentionDays: number): Promise<void> {
  if (retentionDays === 0) return;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  try {
    const result = await prisma.interaction.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (result.count > 0) console.log(`[retention] Deleted ${result.count} old interactions`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "retention cleanup failed";
    console.error(`[retention] ${message}`);
  }
}
