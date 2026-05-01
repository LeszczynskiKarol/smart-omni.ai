const API = import.meta.env.DEV
  ? "https://dev.torweb.pl"
  : "https://voice.torweb.pl";
const TOKEN_KEY = "smart-omni-token";

// ── Auth ──

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch(`${API}/api/models`, {
    headers: { Authorization: `Bearer ${password}` },
  });
  if (res.ok) {
    setToken(password);
    return true;
  }
  return false;
}

function h() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ── Types ──

export type ModelId = "claude-haiku-4-5" | "claude-sonnet-4-6";

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
export interface Source {
  index: number;
  title: string;
  url: string;
}

export interface ProcessedFile {
  s3Key: string;
  filename: string;
  mimeType: string;
  size: number;
  extractedText: string | null;
  visionDescription: string | null;
  processingMethod: string;
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
  sources: Source[];
  researchStatus: string[];
  didResearch: boolean;
  error?: string;
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

// ── File Upload ──

export async function uploadFiles(
  files: File[],
): Promise<{ files: ProcessedFile[]; count: number }> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${API}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    // No Content-Type — browser sets multipart boundary
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }
  return res.json();
}

// ── Voice (non-streaming) ──

export async function sendVoice(
  text: string,
  conversationId?: string,
  model: ModelId = "claude-haiku-4-5",
  attachments?: ProcessedFile[],
): Promise<VoiceResponse> {
  const r = await fetch(`${API}/api/voice`, {
    method: "POST",
    headers: h(),
    body: JSON.stringify({
      text,
      conversationId,
      model,
      stream: false,
      attachments,
    }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

// ── Voice (streaming) ──

export function sendVoiceStreaming(
  text: string,
  conversationId: string | undefined,
  model: ModelId,
  onStatus: (msg: string) => void,
  attachments?: ProcessedFile[],
): Promise<VoiceResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/voice`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${getToken()}`);

    let lastIndex = 0;
    let resolved = false;

    xhr.onprogress = () => {
      const chunk = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;
      for (const line of chunk.split("\n").filter(Boolean)) {
        try {
          const ev = JSON.parse(line);
          if (ev.type === "status" && ev.message) onStatus(ev.message);
          if (ev.type === "result" && !resolved) {
            resolved = true;
            resolve(ev as unknown as VoiceResponse);
          }
        } catch {}
      }
    };

    xhr.onload = () => {
      if (resolved) return;

      // Non-streaming response (actions like gmail_send)
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.response !== undefined) {
          resolved = true;
          resolve(data as VoiceResponse);
          return;
        }
      } catch {}

      reject(new Error("No result in stream"));
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timeout"));
    xhr.timeout = 120000;
    xhr.send(
      JSON.stringify({
        text,
        conversationId,
        model,
        stream: true,
        attachments,
      }),
    );
  });
}

// ── Conversations ──

export async function getConversations(page = 1, search?: string) {
  const p = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) p.set("search", search);
  const r = await fetch(`${API}/api/conversations?${p}`, { headers: h() });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<{
    conversations: ConversationSummary[];
    pagination: any;
  }>;
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

export async function updateTopic(id: string, topic: string) {
  await fetch(`${API}/api/conversations/${id}`, {
    method: "PUT",
    headers: h(),
    body: JSON.stringify({ topic }),
  });
}

export async function deleteConversation(id: string) {
  await fetch(`${API}/api/conversations/${id}`, {
    method: "DELETE",
    headers: h(),
  });
}

export async function globalSearch(q: string): Promise<SearchResult> {
  const r = await fetch(
    `${API}/api/search?q=${encodeURIComponent(q)}&limit=20`,
    { headers: h() },
  );
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getStats(): Promise<GlobalStats> {
  const r = await fetch(`${API}/api/stats`, { headers: h() });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getDownloadUrl(s3Key: string): Promise<string> {
  const r = await fetch(
    `${API}/api/download?key=${encodeURIComponent(s3Key)}`,
    { headers: h() },
  );
  if (!r.ok) throw new Error(`${r.status}`);
  const data = await r.json();
  return data.url;
}
