export type BotStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type MessageType = "TEXT" | "AUDIO" | "VIDEO";
export type ButtonColor = "BLUE" | "GREEN" | "RED";
export type ButtonAction = "OPEN_URL" | "LIVEPIX_PAYMENT";

export type MessageButton = {
  id: string;
  label: string;
  color: ButtonColor;
  action: ButtonAction;
  url?: string;
};

export type MessageStep = {
  id: string;
  title: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  delayMs: number;
  buttons: MessageButton[];
};

export type Bot = {
  id: string;
  name: string;
  messageFlow: MessageStep[];
  checkoutAmount: number;
  status: BotStatus;
  createdAt: string;
  updatedAt: string;
};

export type BotPayload = {
  name: string;
  token?: string;
  messageFlow: MessageStep[];
  checkoutAmount: number;
};

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };
export type UserSummary = { id: string; telegramId: string; username: string | null; firstName: string | null; lastName: string | null };
export type Transaction = { id: string; amount: number; status: string; paymentMethod: string; pixCode: string | null; checkoutUrl: string | null; createdAt: string; user: UserSummary };
export type Interaction = { id: string; type: string; direction: string; content: string | null; payload?: object; createdAt: string; user: UserSummary | null };
export type Stats = { totalInteractions: number; totalUsers: number; checkoutClicks: number; messageCount: number; callbackCount: number; dailyActiveUsers: number };

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
  const response = await fetch(path, {
    ...options,
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
  return response.json() as Promise<T>;
}

export const api = {
  bots: () => request<Bot[]>("/api/bots"),
  createBot: (payload: BotPayload) => request<Bot>("/api/bots", { method: "POST", body: JSON.stringify(payload) }),
  updateBot: (id: string, payload: BotPayload) => request<Bot>(`/api/bots/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  setStatus: (id: string, status: BotStatus) => request<Bot>(`/api/bots/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteBot: (id: string) => request<void>(`/api/bots/${id}`, { method: "DELETE" }),
  transactions: (id: string, page: number) => request<Paginated<Transaction>>(`/api/bots/${id}/transactions?page=${page}&pageSize=10`),
  interactions: (id: string, page: number, filters: URLSearchParams) => request<Paginated<Interaction>>(`/api/bots/${id}/interactions?page=${page}&pageSize=10&${filters}`),
  stats: (id: string) => request<Stats>(`/api/bots/${id}/interactions/stats`)
};
