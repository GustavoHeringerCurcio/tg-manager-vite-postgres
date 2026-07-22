export type BotStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type MessageType = "TEXT" | "AUDIO" | "VIDEO" | "IMAGE";
export type ButtonColor = "BLUE" | "GREEN" | "RED";
export type ButtonAction = "OPEN_URL" | "LIVEPIX_PAYMENT";

export type LivePixResponse = {
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  includeQrCode?: boolean;
  includePixCode?: boolean;
  includeCheckoutUrl?: boolean;
};

export type PaymentFlow = {
  steps: MessageStep[];
  verifyLabel: string;
  pixCopyLabel: string;
  unpaidAudioFileIds: string[];
  verifyPaymentFailAudios?: string[];
  verifyPaymentSuccessAudios?: string[];
  isVerifyPaymentAudioEnabled?: boolean;
  copyPixAudios?: string[];
  isCopyPixAudioEnabled?: boolean;
  deliverables?: MessageStep[];
};

export type MessageButton = {
  id: string;
  label: string;
  color: ButtonColor;
  action: ButtonAction;
  url?: string;
  price?: number;
};

export type DailyAudioConfig = {
  enabled: boolean;
  audios: Record<string, string>;
  fallback?: string;
  timezone?: string;
};

export type MessageStep = {
  id: string;
  title: string;
  type: MessageType;
  text?: string;
  mediaUrls: string[];
  delayMs: number;
  buttons: MessageButton[];
  chatAction?: boolean;
  includeQrCode?: boolean;
  includePixCode?: boolean;
  includeCheckoutUrl?: boolean;
  dailyAudios?: DailyAudioConfig;
};

export type BotSettings = {
  timezone?: string;
  language?: string;
  maxDailyPixGenerations?: number;
  resetPixAfterStart?: boolean;
  adminTelegramIds?: string[];
};

export type Bot = {
  id: string;
  name: string;
  photoUrl?: string | null;
  messageFlow: MessageStep[];
  remarketing: RemarketingConfig;
  paymentFlow: PaymentFlow;
  timeCompliments?: TimeComplimentConfig;
  settings?: BotSettings;
  livepixConfigured?: boolean;
  fbPixelId?: string | null;
  status: BotStatus;
  createdAt: string;
  updatedAt: string;
};

export type DiscountTier = {
  afterMessages: number;
  percentage: number;
};

export type DiscountOfferConfig = {
  enabled: boolean;
  tiers: DiscountTier[];
  labelTemplate?: string;
  showOriginalPrice?: boolean;
};

export type TimeComplimentPreset = {
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export type TimeComplimentConfig = {
  timezone: string;
  fallback: string;
  presets: TimeComplimentPreset[];
};

export type RemarketingConfig = {
  enabled: boolean;
  intervalMs: number;
  maxSends: number;
  messages: MessageStep[];
  discountOffer: DiscountOfferConfig;
  skipStale?: boolean;
  initialDelayMs?: number;
};

export type FacebookPixelConfig = {
  pixelId: string | null;
  hasToken: boolean;
  enabled: boolean;
};

export type FacebookPixelTestResult = {
  sent: boolean;
  eventId: string;
  error?: string;
};

export type RemarketingStateItem = {
  id: string;
  userId: string;
  nextIndex: number;
  totalSent: number;
  nextSendAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserSummary;
};

export type RemarketingStatusConfig = {
  intervalMs: number;
  maxSends: number;
  messageCount: number;
  messageTitles: string[];
  discountOffer: DiscountOfferConfig;
};

export type RemarketingStatusResponse = Paginated<RemarketingStateItem> & {
  config: RemarketingStatusConfig | null;
  serverTime: string;
};

export type BotPayload = {
  name: string;
  token?: string;
  photoUrl?: string | null;
  messageFlow: MessageStep[];
  remarketing: RemarketingConfig;
  paymentFlow: PaymentFlow;
  timeCompliments?: TimeComplimentConfig;
};

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };
export type UserSummary = { id: string; telegramId: string; username: string | null; firstName: string | null; lastName: string | null };
export type User = UserSummary & { sessionCount: number; transactionCount: number };
export type Transaction = { id: string; amount: number; status: string; paymentMethod: string; pixCode: string | null; checkoutUrl: string | null; createdAt: string; user: UserSummary };
export type Interaction = { id: string; type: string; direction: string; content: string | null; payload?: object; sessionId: string | null; stepIndex: number | null; buttonId: string | null; messageId: string | null; chatId: string | null; metadata: Record<string, unknown> | null; createdAt: string; user: UserSummary | null };
export type Stats = { totalInteractions: number; totalUsers: number; checkoutClicks: number; messageCount: number; callbackCount: number; dailyActiveUsers: number };

export type Granularity = "daily" | "weekly" | "monthly";

export type DashboardPeriod = {
  from?: string;
  to?: string;
  granularity: Granularity;
};

export type DashboardStatNumber = {
  value: number;
  previousValue: number;
  changePercent: number | null;
};

export type DashboardStatsResponse = {
  stats: {
    totalRevenue: number;
    totalUsers: number;
    conversionRate: number;
    totalInteractions: number;
    checkoutClicks: number;
    orders: number;
    messageCount: number;
    callbackCount: number;
  };
  previousStats: {
    totalRevenue: number;
    totalUsers: number;
    conversionRate: number;
    totalInteractions: number;
    checkoutClicks: number;
    orders: number;
    messageCount: number;
    callbackCount: number;
  } | null;
  dailyActiveUsers: number;
  timeline: Array<{
    date: string;
    revenue: number;
    transactions: number;
    newUsers: number;
    interactions: number;
  }>;
};
export type UserSession = { id: string; botId: string; userId: string; status: string; currentStepIndex: number | null; stepsCompleted: number[]; messageCount: number; metadata: Record<string, unknown>; startedAt: string; endedAt: string | null; createdAt: string; updatedAt: string; user: UserSummary };
export type ChatTimelineItem = { id: string; direction: string; type: string; content: string | null; stepIndex: number | null; buttonId: string | null; messageId: string | null; chatId: string | null; metadata: Record<string, unknown> | null; createdAt: string };

let authToken = localStorage.getItem("botflix_admin_password") ?? "";

export function setAuthToken(token: string): void {
  authToken = token;
  if (token) localStorage.setItem("botflix_admin_password", token);
  else localStorage.removeItem("botflix_admin_password");
}

export function getAuthToken(): string {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = options.signal ? null : new AbortController();
  const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;

  try {
    const response = await fetch(path, {
      ...options,
      signal: options.signal ?? controller?.signal,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers
      }
    });

    if (response.status === 401) {
      setAuthToken("");
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
      throw new Error(body.error ?? "Request failed");
    }

    if (response.status === 204) return undefined as T;

    try {
      return (await response.json()) as T;
    } catch {
      throw new Error("Invalid JSON response");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    throw new Error(message);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const api = {
  bots: () => request<Bot[]>("/api/bots"),
  getBot: (id: string) => request<Bot>(`/api/bots/${id}`),
  createBot: (payload: BotPayload) => request<Bot>("/api/bots", { method: "POST", body: JSON.stringify(payload) }),
  updateBot: (id: string, payload: BotPayload) => request<Bot>(`/api/bots/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  getFileIdFromUrl: (botId: string, chatId: string, url: string) =>
    request<{ ok: boolean; fileId: string; fileUniqueId?: string }>(`/api/utils/file-id`, {
      method: "POST",
      body: JSON.stringify({ botId, chatId, url })
    }),
  getFileIdFromFile: async (botId: string, chatId: string, file: File): Promise<{ ok: boolean; fileId: string; fileUniqueId?: string }> => {
    const form = new FormData();
    form.set("botId", botId);
    form.set("chatId", chatId);
    form.set("file", file, file.name);

    const response = await fetch("/api/utils/file-id", {
      method: "POST",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: form
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: "Request failed" }))) as { error?: string };
      throw new Error(body.error ?? "Request failed");
    }

    return (await response.json()) as { ok: boolean; fileId: string; fileUniqueId?: string };
  },
  users: (botId: string, page: number, search?: string) =>
    request<Paginated<User>>(`/api/bots/${botId}/users?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  setStatus: (id: string, status: BotStatus) => request<Bot>(`/api/bots/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteBot: (id: string) => request<void>(`/api/bots/${id}`, { method: "DELETE" }),
  transactions: (id: string, page: number) => request<Paginated<Transaction>>(`/api/bots/${id}/transactions?page=${page}&pageSize=10`),
  interactions: (id: string, page: number, filters: URLSearchParams) => request<Paginated<Interaction>>(`/api/bots/${id}/interactions?page=${page}&pageSize=10&${filters}`),
  stats: (id: string) => request<Stats>(`/api/bots/${id}/interactions/stats`),
  dashboardStats: (id: string, period: DashboardPeriod) => {
    const params = new URLSearchParams();
    if (period.from) params.set("from", period.from);
    if (period.to) params.set("to", period.to);
    params.set("granularity", period.granularity);
    return request<DashboardStatsResponse>(`/api/bots/${id}/dashboard/stats?${params}`);
  },
  sessions: (botId: string, page: number, filters?: URLSearchParams) => request<Paginated<UserSession>>(`/api/bots/${botId}/sessions?page=${page}&pageSize=20${filters ? `&${filters}` : ""}`),
  chatTimeline: (botId: string, sessionId: string) => request<ChatTimelineItem[]>(`/api/bots/${botId}/sessions/${sessionId}/chat`),
  remarketingStates: (botId: string, page: number, statusFilter?: string) =>
    request<RemarketingStatusResponse>(`/api/bots/${botId}/remarketing-states?page=${page}&pageSize=10${statusFilter ? `&status=${statusFilter}` : ""}`),
  cancelAllRemarketing: (botId: string) => request<{ count: number }>(`/api/bots/${botId}/remarketing-states/cancel-all`, { method: "POST" }),
  toggleRemarketing: (botId: string, userId: string, active: boolean) => request<{ ok: boolean }>(`/api/bots/${botId}/remarketing-states/${userId}`, { method: "PATCH", body: JSON.stringify({ active }) }),
  exportRemarketingStates: async (botId: string) => {
    const response = await fetch(`/api/bots/${botId}/remarketing-states/export`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });
    if (!response.ok) throw new Error("Failed to export");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remarketing-${botId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  getPixelConfig: (botId: string) => request<FacebookPixelConfig>(`/api/bots/${botId}/pixel`),
  updatePixelConfig: (botId: string, payload: { pixelId: string; accessToken: string; enabled?: boolean }) => request<{ pixelId: string; hasToken: boolean; enabled: boolean }>(`/api/bots/${botId}/pixel`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePixelConfig: (botId: string) => request<void>(`/api/bots/${botId}/pixel`, { method: "DELETE" }),
  testPixelEvent: (botId: string) => request<FacebookPixelTestResult>(`/api/bots/${botId}/pixel/test`, { method: "POST" }),
  getBotSettings: (botId: string) => request<BotSettings>(`/api/bots/${botId}/settings`),
  updateBotSettings: (botId: string, settings: BotSettings) => request<BotSettings>(`/api/bots/${botId}/settings`, { method: "PUT", body: JSON.stringify(settings) }),
};
