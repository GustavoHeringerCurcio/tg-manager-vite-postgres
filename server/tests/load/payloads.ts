const BASE_USER_ID = 2000000;
const BOT_ID = 987654321;

let counter = 0;

function nextId(): number {
  return ++counter;
}

export function resetCounter(): void {
  counter = 0;
}

function makeUser(vuId: number, iterationId: number) {
  const uid = BASE_USER_ID + vuId * 10000 + iterationId;
  return {
    id: uid,
    is_bot: false,
    first_name: `LoadUser${uid}`,
    username: `loaduser${uid}`,
    language_code: "en",
  };
}

function makeChat(user: ReturnType<typeof makeUser>) {
  return {
    id: user.id,
    first_name: user.first_name,
    username: user.username,
    type: "private",
  };
}

export function startUpdatePayload(vuId: number, iterationId: number): Record<string, unknown> {
  const user = makeUser(vuId, iterationId);
  const updateId = nextId();
  return {
    update_id: updateId,
    message: {
      message_id: nextId(),
      from: user,
      chat: makeChat(user),
      date: Math.floor(Date.now() / 1000),
      text: "/start",
      entities: [{ offset: 0, length: 6, type: "bot_command" }],
    },
  };
}

export function messagePayload(
  vuId: number,
  iterationId: number,
  text?: string
): Record<string, unknown> {
  const user = makeUser(vuId, iterationId);
  return {
    update_id: nextId(),
    message: {
      message_id: nextId(),
      from: user,
      chat: makeChat(user),
      date: Math.floor(Date.now() / 1000),
      text: text || `Hello ${vuId}-${iterationId}`,
    },
  };
}

export function callbackQueryPayload(
  vuId: number,
  iterationId: number,
  callbackData?: string
): Record<string, unknown> {
  const user = makeUser(vuId, iterationId);
  const chatId = user.id;
  const msgId = nextId();
  return {
    update_id: nextId(),
    callback_query: {
      id: String(nextId()),
      from: user,
      message: {
        message_id: msgId,
        from: { id: BOT_ID, is_bot: true, first_name: "TestBot", username: "test_bot" },
        chat: { id: chatId, first_name: "BotChat", type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: "Click a button:",
      },
      chat_instance: String(nextId()),
      data: callbackData || `livepix_payment:test_btn_${nextId()}`,
    },
  };
}

export function mixedPayload(vuId: number, iterationId: number): Record<string, unknown> {
  const r = Math.random();
  if (r < 0.5) {
    return startUpdatePayload(vuId, iterationId);
  } else if (r < 0.8) {
    return messagePayload(vuId, iterationId);
  } else {
    return callbackQueryPayload(vuId, iterationId);
  }
}
