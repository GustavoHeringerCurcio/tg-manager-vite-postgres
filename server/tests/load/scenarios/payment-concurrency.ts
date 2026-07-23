import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, BOT_ID } from "../config.ts";

let counter = 0;
function nextId(): number {
  return ++counter;
}

const BUTTON_IDS = ["pay_basic", "pay_pro"];
const BOT_ID_NUM = 987654321;

function makePaymentPayload(vuId: number, iterId: number): Record<string, unknown> {
  const uid = 3000000 + vuId * 10000 + iterId;
  const callbackId = nextId();
  const msgId = nextId();
  const buttonId = BUTTON_IDS[iterId % BUTTON_IDS.length];

  return {
    update_id: nextId(),
    callback_query: {
      id: String(callbackId),
      from: {
        id: uid,
        is_bot: false,
        first_name: `Payer${uid}`,
        username: `payer${uid}`,
        language_code: "en",
      },
      message: {
        message_id: msgId,
        from: {
          id: BOT_ID_NUM,
          is_bot: true,
          first_name: "TestBot",
          username: "test_bot",
        },
        chat: {
          id: uid,
          first_name: `Payer${uid}`,
          username: `payer${uid}`,
          type: "private",
        },
        date: Math.floor(Date.now() / 1000),
        text: "Choose your plan:",
      },
      chat_instance: String(callbackId),
      data: `livepix_payment:${buttonId}`,
    },
  };
}

export function setup(): void {
  counter = 0;
  console.log(`[payment] Target: ${BASE_URL}/webhook/${BOT_ID}`);
  console.log(`[payment] Button IDs: ${BUTTON_IDS.join(", ")}`);
}

export default function (): void {
  const vuId = __VU;
  const iterId = __ITER;
  const payload = JSON.stringify(makePaymentPayload(vuId, iterId));

  const res = http.post(
    `${BASE_URL}/webhook/${BOT_ID}`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "webhook-payment" },
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
  console.log("[payment] Scenario complete.");
}
