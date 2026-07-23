import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, BOT_ID } from "../config.ts";
import { startUpdatePayload, resetCounter } from "../payloads.ts";

export function setup(): void {
  resetCounter();
  console.log(`[start-message] Target: ${BASE_URL}/webhook/${BOT_ID}`);
}

export default function (): void {
  const vuId = __VU;
  const iterId = __ITER;
  const payload = JSON.stringify(startUpdatePayload(vuId, iterId));

  const res = http.post(
    `${BASE_URL}/webhook/${BOT_ID}`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "webhook-start" },
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

  sleep(0.5);
}

export function teardown(): void {
  console.log("[start-message] Scenario complete.");
}
