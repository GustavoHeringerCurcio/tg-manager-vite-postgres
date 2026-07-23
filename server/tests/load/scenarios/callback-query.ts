import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, BOT_ID } from "../config.ts";
import { callbackQueryPayload, resetCounter } from "../payloads.ts";

export function setup(): void {
  resetCounter();
  console.log(`[callback-query] Target: ${BASE_URL}/webhook/${BOT_ID}`);
}

export default function (): void {
  const vuId = __VU;
  const iterId = __ITER;
  const payload = JSON.stringify(callbackQueryPayload(vuId, iterId));

  const res = http.post(
    `${BASE_URL}/webhook/${BOT_ID}`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "webhook-callback" },
    }
  );

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response ok": (r) => {
      try {
        return JSON.parse(r.body as string).ok === true;
      } catch {
        return false;
      }
    },
  });

  sleep(0.3);
}

export function teardown(): void {
  console.log("[callback-query] Scenario complete.");
}
