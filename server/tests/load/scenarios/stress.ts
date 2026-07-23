import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, BOT_ID } from "../config.ts";

let counter = 0;
function nextId(): number {
  return ++counter;
}

const BOT_ID_NUM = 987654321;

function makeUser(vuId: number, iterId: number) {
  const uid = 4000000 + vuId * 10000 + iterId;
  return {
    id: uid,
    is_bot: false,
    first_name: `StressUser${uid}`,
    username: `stress${uid}`,
    language_code: "en",
  };
}

type PayloadType = "start" | "message" | "payment";

function buildPayload(vuId: number, iterId: number): Record<string, unknown> {
  const user = makeUser(vuId, iterId);
  const uid = user.id;
  const msgId = nextId();
  const updateId = nextId();

  const rand = Math.random();

  let type: PayloadType;
  if (rand < 0.4) {
    type = "start";
  } else if (rand < 0.7) {
    type = "payment";
  } else {
    type = "message";
  }

  switch (type) {
    case "start":
      return {
        update_id: updateId,
        message: {
          message_id: msgId,
          from: user,
          chat: { id: uid, first_name: user.first_name, username: user.username, type: "private" },
          date: Math.floor(Date.now() / 1000),
          text: "/start",
          entities: [{ offset: 0, length: 6, type: "bot_command" }],
        },
      };
    case "payment":
      return {
        update_id: updateId,
        callback_query: {
          id: String(nextId()),
          from: user,
          message: {
            message_id: msgId,
            from: { id: BOT_ID_NUM, is_bot: true, first_name: "TestBot", username: "test_bot" },
            chat: { id: uid, first_name: user.first_name, username: user.username, type: "private" },
            date: Math.floor(Date.now() / 1000),
            text: "Choose your plan:",
          },
          chat_instance: String(nextId()),
          data: `livepix_payment:pay_basic`,
        },
      };
    default:
      return {
        update_id: updateId,
        message: {
          message_id: msgId,
          from: user,
          chat: { id: uid, first_name: user.first_name, username: user.username, type: "private" },
          date: Math.floor(Date.now() / 1000),
          text: `Message ${iterId} from VU ${vuId}`,
        },
      };
  }
}

export function setup(): void {
  counter = 0;
  console.log(`[stress] Target: ${BASE_URL}/webhook/${BOT_ID}`);
}

export default function (): void {
  const vuId = __VU;
  const iterId = __ITER;
  const payload = JSON.stringify(buildPayload(vuId, iterId));

  const res = http.post(
    `${BASE_URL}/webhook/${BOT_ID}`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "webhook-stress" },
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

  sleep(0.2 + Math.random() * 0.3);
}

export function teardown(): void {
  console.log("[stress] Scenario complete.");
}
