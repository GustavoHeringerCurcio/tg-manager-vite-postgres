import { Counter, Gauge, collectDefaultMetrics, register } from "prom-client";

collectDefaultMetrics({ prefix: "botflix_" });

const labels = ["bot_id"] as const;

export const webhooksTotal = new Counter({
  name: "botflix_webhooks_total",
  help: "Total webhook requests received",
  labelNames: ["bot_id", "status"] as const,
});

export const messagesSent = new Counter({
  name: "botflix_messages_sent_total",
  help: "Outgoing Telegram messages sent",
  labelNames: [...labels, "type"] as const,
});

export const messagesFailed = new Counter({
  name: "botflix_messages_failed_total",
  help: "Outgoing Telegram messages that failed",
  labelNames: [...labels, "reason"] as const,
});

export const paymentsCreated = new Counter({
  name: "botflix_payments_created_total",
  help: "LivePix payments created",
  labelNames: [...labels, "status"] as const,
});

export const paymentsConfirmed = new Counter({
  name: "botflix_payments_confirmed_total",
  help: "Payments confirmed via callback or poller",
  labelNames: [...labels, "source"] as const,
});

export const interactionsLogged = new Counter({
  name: "botflix_interactions_logged_total",
  help: "Interaction rows written to the database",
  labelNames: [...labels, "direction"] as const,
});

export const interactionsFailed = new Counter({
  name: "botflix_interactions_failed_total",
  help: "Interaction log writes that failed",
  labelNames: [...labels] as const,
});

export const remarketingJobsScheduled = new Counter({
  name: "botflix_remarketing_jobs_scheduled_total",
  help: "Remarketing pg-boss jobs successfully scheduled",
  labelNames: [...labels] as const,
});

export const remarketingJobsFailed = new Counter({
  name: "botflix_remarketing_jobs_failed_total",
  help: "Remarketing pg-boss jobs that failed to schedule",
  labelNames: [...labels, "reason"] as const,
});

export const remarketingSent = new Counter({
  name: "botflix_remarketing_sent_total",
  help: "Remarketing messages successfully sent",
  labelNames: [...labels] as const,
});

export const remarketingSendFailed = new Counter({
  name: "botflix_remarketing_send_failed_total",
  help: "Remarketing messages that failed to send",
  labelNames: [...labels] as const,
});

export const dbPoolAvailable = new Gauge({
  name: "botflix_db_pool_available",
  help: "Available DB connections in the Prisma pool (1 = healthy)",
});

export async function metricsResponse(): Promise<string> {
  dbPoolAvailable.set(1);
  return register.metrics();
}
