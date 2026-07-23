function createTokenBucket(rate: number, burst: number): () => Promise<void> {
  let tokens = burst;
  let lastRefill = Date.now();
  const pending: Array<() => void> = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  function refill(): void {
    const now = Date.now();
    const elapsed = (now - lastRefill) / 1000;
    tokens = Math.min(burst, tokens + elapsed * rate);
    lastRefill = now;
  }

  function flush(): void {
    while (pending.length > 0 && tokens >= 1) {
      tokens -= 1;
      const resolve = pending.shift()!;
      resolve();
    }
    if (pending.length === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  return async () => {
    refill();
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    return new Promise<void>((resolve) => {
      pending.push(resolve);
      if (timer === null) {
        timer = setInterval(flush, 100);
      }
    });
  };
}

export function applyRateLimit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  telegram: any,
  rate: number,
  burst: number
): void {
  if (typeof telegram.callApi !== "function") return;
  const original = (telegram.callApi as Function).bind(telegram);
  const acquire = createTokenBucket(rate, burst);

  telegram.callApi = async function (...args: unknown[]) {
    await acquire();
    return original(...args);
  };
}
