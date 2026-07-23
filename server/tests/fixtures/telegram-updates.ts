const BOT_ID = 987654321;

let updateCounter = 0;
let messageCounter = 0;

function nextUpdateId(): number {
  return ++updateCounter;
}

function nextMessageId(): number {
  return ++messageCounter;
}

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramMessage = {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text: string;
  entities?: Array<{ offset: number; length: number; type: string }>;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message: TelegramMessage;
  chat_instance: string;
  data: string;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramChat = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  type: "private" | "group" | "supergroup" | "channel";
};

let userIdCounter = 1000;

function nextUserId(): number {
  return ++userIdCounter;
}

function makeUser(overrides?: Partial<TelegramUser>): TelegramUser {
  const id = overrides?.id ?? nextUserId();
  return {
    id,
    is_bot: false,
    first_name: `TestUser${id}`,
    username: `testuser${id}`,
    language_code: "en",
    ...overrides,
  };
}

function makeChat(user: TelegramUser): TelegramChat {
  return {
    id: user.id,
    first_name: user.first_name,
    username: user.username,
    type: "private",
  };
}

function makeBotMessage(chatId: number, text: string): TelegramMessage {
  return {
    message_id: nextMessageId(),
    from: { id: BOT_ID, is_bot: true, first_name: "TestBot", username: "test_bot" },
    chat: { id: chatId, first_name: "BotChat", type: "private" },
    date: Math.floor(Date.now() / 1000),
    text,
  };
}

export function createStartUpdate(overrides?: {
  userId?: number;
  text?: string;
}): TelegramUpdate {
  const user = makeUser({ id: overrides?.userId });
  const text = overrides?.text ?? "/start";
  return {
    update_id: nextUpdateId(),
    message: {
      message_id: nextMessageId(),
      from: user,
      chat: makeChat(user),
      date: Math.floor(Date.now() / 1000),
      text,
      entities: text === "/start"
        ? [{ offset: 0, length: 6, type: "bot_command" }]
        : undefined,
    },
  };
}

export function createMessageUpdate(overrides?: {
  userId?: number;
  text?: string;
}): TelegramUpdate {
  const user = makeUser({ id: overrides?.userId });
  return {
    update_id: nextUpdateId(),
    message: {
      message_id: nextMessageId(),
      from: user,
      chat: makeChat(user),
      date: Math.floor(Date.now() / 1000),
      text: overrides?.text ?? "Hello!",
    },
  };
}

export function createCallbackQueryUpdate(overrides?: {
  userId?: number;
  data?: string;
  messageText?: string;
  messageId?: number;
}): TelegramUpdate {
  const user = makeUser({ id: overrides?.userId });
  const chatId = user.id;
  const data = overrides?.data ?? "livepix_payment:test_button";
  return {
    update_id: nextUpdateId(),
    callback_query: {
      id: String(nextUpdateId()),
      from: user,
      message: makeBotMessage(chatId, overrides?.messageText ?? "Click a button:"),
      chat_instance: String(nextUpdateId()),
      data,
    },
  };
}

export function createPaymentCallbackUpdate(overrides?: {
  userId?: number;
  buttonId?: string;
  discountPrice?: number;
}): TelegramUpdate {
  const user = makeUser({ id: overrides?.userId });
  const chatId = user.id;
  const buttonId = overrides?.buttonId ?? "pay_basic";
  let data = `livepix_payment:${buttonId}`;
  if (overrides?.discountPrice) {
    data += `:${Math.round(overrides.discountPrice * 100)}`;
  }
  return {
    update_id: nextUpdateId(),
    callback_query: {
      id: String(nextUpdateId()),
      from: user,
      message: makeBotMessage(chatId, "Choose your plan:"),
      chat_instance: String(nextUpdateId()),
      data,
    },
  };
}

export function createVerifyPaymentUpdate(overrides?: {
  userId?: number;
  reference?: string;
}): TelegramUpdate {
  const user = makeUser({ id: overrides?.userId });
  const chatId = user.id;
  const reference = overrides?.reference ?? "mock_ref_123";
  return {
    update_id: nextUpdateId(),
    callback_query: {
      id: String(nextUpdateId()),
      from: user,
      message: makeBotMessage(chatId, "Payment details:"),
      chat_instance: String(nextUpdateId()),
      data: `livepix_verify:${reference}`,
    },
  };
}

export function createCopyPixUpdate(overrides?: {
  userId?: number;
  reference?: string;
}): TelegramUpdate {
  const user = makeUser({ id: overrides?.userId });
  const chatId = user.id;
  const reference = overrides?.reference ?? "mock_ref_123";
  return {
    update_id: nextUpdateId(),
    callback_query: {
      id: String(nextUpdateId()),
      from: user,
      message: makeBotMessage(chatId, "PIX code:"),
      chat_instance: String(nextUpdateId()),
      data: `livepix_copy:${reference}`,
    },
  };
}

export function resetCounters(): void {
  updateCounter = 0;
  messageCounter = 0;
  userIdCounter = 1000;
}

export function batchStartUpdates(count: number): TelegramUpdate[] {
  return Array.from({ length: count }, () => createStartUpdate());
}

export function batchPaymentCallbackUpdates(count: number, buttonId?: string, discountPrice?: number): TelegramUpdate[] {
  return Array.from({ length: count }, () =>
    createPaymentCallbackUpdate({ buttonId, discountPrice })
  );
}

export function mixedUpdates(count: number): TelegramUpdate[] {
  const updates: TelegramUpdate[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.5) {
      updates.push(createStartUpdate());
    } else if (r < 0.8) {
      updates.push(createCallbackQueryUpdate());
    } else {
      updates.push(createMessageUpdate());
    }
  }
  return updates;
}
