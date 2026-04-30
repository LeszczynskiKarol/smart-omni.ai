const API = "https://voice.torweb.pl";

export const getToken = (): string =>
  (typeof localStorage !== "undefined" && localStorage.getItem("omni_token")) ||
  "";
export const setToken = (t: string) => localStorage.setItem("omni_token", t);
export const clearToken = () => localStorage.removeItem("omni_token");

const h = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export async function login(username: string, password: string): Promise<void> {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error("Nieprawidłowe dane logowania");
  const { token } = await r.json();
  setToken(token);
}

// ── Types ──

export interface VoiceAction {
  action: string;
  params: Record<string, any>;
  status?: "success" | "error";
  result?: any;
  error?: string;
}

export interface Stats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  model: string;
  latencyMs: number;
}

export interface VoiceResponse {
  response: string;
  actions: VoiceAction[];
  thinking?: string;
  needsInput?: boolean;
  conversationId: string;
  messageId: string;
  isNewConversation: boolean;
  stats: Stats;
}

export interface ConversationSummary {
  id: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  lastMessage: { content: string; role: string; createdAt: string } | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  model?: string;
  latencyMs?: number;
  actions?: any;
  thinking?: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    messageCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
  };
  messages: Message[];
}

export interface SearchResult {
  query: string;
  messageResults: {
    messages: {
      id: string;
      role: string;
      content: string;
      createdAt: string;
      conversationId: string;
      conversationTopic: string;
      matchContext: string;
    }[];
    pagination: { total: number };
  };
  conversationResults: {
    id: string;
    topic: string;
    messageCount: number;
    updatedAt: string;
  }[];
}

export interface GlobalStats {
  totalConversations: number;
  totalMessages: number;
  todayMessages: number;
  tokens: { totalInput: number; totalOutput: number; total: number };
  totalCostUsd: number;
  totalCostPln: string;
}

// ── Endpoints ──

export async function sendVoice(
  text: string,
  conversationId?: string,
): Promise<VoiceResponse> {
  const r = await fetch(`${API}/api/voice`, {
    method: "POST",
    headers: h(),
    body: JSON.stringify({ text, conversationId }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export async function getConversations(
  page = 1,
  search?: string,
): Promise<{ conversations: ConversationSummary[]; pagination: any }> {
  const p = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) p.set("search", search);
  const r = await fetch(`${API}/api/conversations?${p}`, { headers: h() });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getConversation(
  id: string,
  search?: string,
): Promise<ConversationDetail> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  const r = await fetch(`${API}/api/conversations/${id}${q}`, { headers: h() });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function updateTopic(id: string, topic: string): Promise<void> {
  await fetch(`${API}/api/conversations/${id}`, {
    method: "PUT",
    headers: h(),
    body: JSON.stringify({ topic }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${API}/api/conversations/${id}`, {
    method: "DELETE",
    headers: h(),
  });
}

export async function globalSearch(q: string): Promise<SearchResult> {
  const r = await fetch(
    `${API}/api/search?q=${encodeURIComponent(q)}&limit=20`,
    {
      headers: h(),
    },
  );
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getStats(): Promise<GlobalStats> {
  const r = await fetch(`${API}/api/stats`, { headers: h() });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
