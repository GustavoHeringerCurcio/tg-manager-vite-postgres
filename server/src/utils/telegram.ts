import { logger } from "./logger.js";
import { delay } from "./async.js";

type TelegramErrorLike = {
  response?: { error_code?: number; description?: string; parameters?: { retry_after?: number } };
  code?: number | string;
  message?: string;
  name?: string;
};

function getErrorCode(err: unknown): number | undefined {
  const e = err as TelegramErrorLike;
  return (e.response?.error_code as number | undefined) ?? (typeof e.code === "number" ? e.code : undefined);
}

function getDescription(err: unknown): string | undefined {
  const e = err as TelegramErrorLike;
  return e.response?.description ?? e.message;
}

function getRetryAfterSeconds(err: unknown): number | undefined {
  const e = err as TelegramErrorLike;
  const retry = e.response?.parameters?.retry_after;
  if (typeof retry === "number" && retry > 0) return retry;
  const desc = getDescription(err);
  if (desc) {
    const m = desc.match(/retry after (\d+)/i);
    if (m) return Number(m[1]);
  }
  return undefined;
}

function isRetriable(err: unknown): boolean {
  const code = getErrorCode(err);
  const desc = (getDescription(err) ?? "").toLowerCase();
  // Telegram 429, transient 5xx, and some known transient conditions
  if (code === 429) return true;
  if (code === 500 || code === 502 || code === 503 || code === 504) return true;
  if (desc.includes("too many requests")) return true;
  if (desc.includes("retry")) return true;
  if (desc.includes("flood")) return true;
  if (desc.includes("timeout")) return true;
  return false;
}

export async function telegramCallWithRetry<T>(
  fn: () => Promise<T>,
  meta: {
    botId: string;
    chatId?: number | string | null;
    action: string;
    fileId?: string | null;
    attempts?: number;
    baseDelayMs?: number;
  }
): Promise<T> {
  const maxAttempts = Math.max(1, meta.attempts ?? 4);
  const baseDelayMs = Math.max(50, meta.baseDelayMs ?? 500);

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const code = getErrorCode(err);
      const desc = getDescription(err) ?? String(err);
      const retryAfterSec = getRetryAfterSeconds(err);
      const canRetry = isRetriable(err) && attempt < maxAttempts;

      if (!canRetry) {
        logger.error(
          {
            botId: meta.botId,
            chatId: meta.chatId ?? null,
            fileId: meta.fileId ?? null,
            attempt,
            maxAttempts,
            code,
            description: desc
          },
          `[telegram][${meta.action}] failed`
        );
        throw err;
      }

      const backoff = retryAfterSec != null
        ? retryAfterSec * 1000
        : Math.min(10000, baseDelayMs * Math.pow(2, attempt - 1));
      const jitter = Math.floor(Math.random() * 100);
      const waitMs = backoff + jitter;

      logger.warn(
        {
          botId: meta.botId,
          chatId: meta.chatId ?? null,
          fileId: meta.fileId ?? null,
          code,
          description: desc
        },
        `[telegram][${meta.action}] retrying after ${waitMs}ms (attempt ${attempt + 1}/${maxAttempts})`
      );

      await delay(waitMs);
    }
  }
}
