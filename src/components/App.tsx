import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import LoginForm from "./LoginForm";
import { getToken, clearToken } from "../lib/api";
import {
  sendVoice,
  sendVoiceStreaming,
  getConversations,
  getConversation,
  globalSearch,
  getStats,
  updateTopic,
  deleteConversation,
  type ModelId,
  type VoiceResponse,
  type Source,
  type ConversationSummary,
  type ConversationDetail,
  type SearchResult,
  type GlobalStats,
  type Stats,
  type Message,
} from "../lib/api";
import {
  createRecognizer,
  speak,
  stopSpeaking,
  sttAvailable,
  ttsAvailable,
} from "../lib/speech";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type AppState =
  | "idle"
  | "listening"
  | "processing"
  | "researching"
  | "speaking";

interface LogEntry {
  id: string;
  type: "user" | "assistant" | "action" | "error" | "research-status";
  text: string;
  time: Date;
  stats?: Stats;
  actions?: VoiceResponse["actions"];
  sources?: Source[];
  didResearch?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Markdown renderer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderInline(text: string, sources?: Source[]): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(\d+)\])/g;
  let last = 0;
  let m;
  let i = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      parts.push(<span key={`t${i++}`}>{text.slice(last, m.index)}</span>);
    if (m[2])
      parts.push(
        <strong key={`b${i++}`} className="font-semibold text-gray-100">
          {m[2]}
        </strong>,
      );
    else if (m[3])
      parts.push(
        <em key={`i${i++}`} className="italic text-gray-300">
          {m[3]}
        </em>,
      );
    else if (m[4]) {
      const idx = parseInt(m[4]);
      const src = sources?.find((s) => s.index === idx);
      parts.push(
        <a
          key={`fn${i++}`}
          href={src?.url || "#"}
          target="_blank"
          rel="noopener"
          onClick={(e) => {
            if (!src) e.preventDefault();
          }}
          className="inline-flex items-center justify-center min-w-[1.2em] px-0.5 text-[10px] font-bold text-accent bg-accent/15 rounded hover:bg-accent/30 transition-colors cursor-pointer no-underline align-super leading-none"
          title={src ? `${src.title}\n${src.url}` : `Źródło [${idx}]`}
        >
          {m[4]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length)
    parts.push(<span key={`e${i}`}>{text.slice(last)}</span>);
  return parts;
}

function RenderedMarkdown({
  text,
  sources,
}: {
  text: string;
  sources?: Source[];
}) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, li) => {
        const h3 = line.match(/^###\s+(.+)/);
        const h2 = !h3 && line.match(/^##\s+(.+)/);
        const h1 = !h2 && !h3 && line.match(/^#\s+(.+)/);
        const bullet = line.match(/^[-•]\s+(.+)/);
        const numbered = line.match(/^(\d+)\.\s+(.+)/);

        if (h3)
          return (
            <h4 key={li} className="text-sm font-semibold text-gray-200 mt-2">
              {renderInline(h3[1], sources)}
            </h4>
          );
        if (h2)
          return (
            <h3 key={li} className="text-[15px] font-bold text-gray-100 mt-3">
              {renderInline(h2[1], sources)}
            </h3>
          );
        if (h1)
          return (
            <h2 key={li} className="text-base font-bold text-white mt-3">
              {renderInline(h1[1], sources)}
            </h2>
          );
        if (bullet)
          return (
            <div key={li} className="flex gap-2 pl-2">
              <span className="text-accent/50 shrink-0">•</span>
              <span>{renderInline(bullet[1], sources)}</span>
            </div>
          );
        if (numbered)
          return (
            <div key={li} className="flex gap-2 pl-1">
              <span className="text-gray-500 shrink-0 font-mono text-xs w-4 text-right">
                {numbered[1]}.
              </span>
              <span>{renderInline(numbered[2], sources)}</span>
            </div>
          );
        if (!line.trim()) return <div key={li} className="h-1" />;
        return <p key={li}>{renderInline(line, sources)}</p>;
      })}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// App
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function App() {
  const [authed, setAuthed] = useState(() => !!getToken());
  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />;

  return (
    <AppMain
      onLogout={() => {
        clearToken();
        setAuthed(false);
      }}
    />
  );
}

function AppMain({ onLogout }: { onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailConv, setDetailConv] = useState<ConversationDetail | null>(null);
  const [detailSearch, setDetailSearch] = useState("");

  const [state, setState] = useState<AppState>("idle");
  const [model, setModel] = useState<ModelId>("claude-haiku-4-5");
  const [convId, setConvId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [liveStatus, setLiveStatus] = useState("");

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [stats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);

  const refreshSidebar = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([getConversations(), getStats()]);
      setConversations(c.conversations);
      setGlobalStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    refreshSidebar();
  }, []);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length, liveStatus]);

  // Global search debounced
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSearchResults(await globalSearch(searchQuery.trim()));
      } catch {
        setSearchResults(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Detail search debounced
  useEffect(() => {
    if (!detailConv) return;
    if (detailSearch.trim().length < 2) {
      getConversation(detailConv.id)
        .then(setDetailConv)
        .catch(() => {});
      return;
    }
    const t = setTimeout(async () => {
      try {
        setDetailConv(
          await getConversation(detailConv.id, detailSearch.trim()),
        );
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [detailSearch]);

  const addLog = (
    type: LogEntry["type"],
    text: string,
    stats?: Stats,
    actions?: VoiceResponse["actions"],
    sources?: Source[],
    didResearch?: boolean,
  ) => {
    setLog((p) => [
      ...p,
      {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        type,
        text,
        time: new Date(),
        stats,
        actions,
        sources,
        didResearch,
      },
    ]);
  };

  // ── Process text with streaming ──

  const processText = async (text: string) => {
    if (!text.trim() || state === "processing" || state === "researching")
      return;
    addLog("user", text);
    setState("researching");
    setLiveStatus("");

    try {
      let res: VoiceResponse;
      const statusMessages: string[] = [];

      try {
        res = await sendVoiceStreaming(
          text,
          convId || undefined,
          model,
          (msg) => {
            setLiveStatus(msg);
            statusMessages.push(msg);
          },
        );
      } catch {
        setState("processing");
        res = await sendVoice(text, convId || undefined, model);
      }

      if (res.conversationId) setConvId(res.conversationId);

      if (res.didResearch && statusMessages.length > 0) {
        addLog("research-status", statusMessages.join("\n"));
      }

      addLog(
        "assistant",
        res.response,
        res.stats,
        res.actions,
        res.sources,
        res.didResearch,
      );

      for (const a of res.actions || []) {
        if (a.status === "success")
          addLog(
            "action",
            `✅ ${a.action}: ${JSON.stringify(a.result).slice(0, 120)}`,
          );
        else if (a.status === "error")
          addLog("error", `❌ ${a.action}: ${a.error}`);
      }

      setLiveStatus("");
      if (ttsAvailable) {
        setState("speaking");
        await speak(res.response);
      }
      setState("idle");
      refreshSidebar();
    } catch (err: any) {
      addLog("error", `Błąd: ${err.message}`);
      setState("idle");
      setLiveStatus("");
    }
  };

  // ── Voice ──

  const startListening = () => {
    if (!sttAvailable) return;
    stopSpeaking();
    setTranscript("");
    setState("listening");
    const rec = createRecognizer({
      onResult: (t) => {
        setTranscript("");
        recRef.current = null;
        processText(t);
      },
      onPartial: (t) => setTranscript(t),
      onEnd: () => {
        if (state === "listening") setState("idle");
      },
      onError: (e) => {
        addLog("error", `STT: ${e}`);
        setState("idle");
      },
    });
    if (rec) {
      recRef.current = rec;
      rec.start();
    }
  };

  const stopListening = () => {
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
    }
  };

  const toggleVoice = () => {
    if (state === "listening") stopListening();
    else if (state === "idle") startListening();
    else if (state === "speaking") {
      stopSpeaking();
      setState("idle");
    }
  };

  const handleSend = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    processText(t);
  };
  const newConv = () => {
    setConvId(null);
    setLog([]);
    setDetailConv(null);
    setLiveStatus("");
    inputRef.current?.focus();
  };

  const openDetail = async (id: string) => {
    try {
      setDetailConv(await getConversation(id));
      setDetailSearch("");
    } catch {}
  };

  const continueConv = async (id: string) => {
    try {
      const d = await getConversation(id);
      setConvId(d.id);
      setDetailConv(null);
      setLog(
        d.messages.map((m, i) => ({
          id: `l${i}${Date.now().toString(36)}`,
          type: m.role as any,
          text: m.content,
          time: new Date(m.createdAt),
          stats:
            m.inputTokens != null
              ? {
                  inputTokens: m.inputTokens!,
                  outputTokens: m.outputTokens!,
                  totalTokens: m.totalTokens!,
                  costUsd: m.costUsd!,
                  model: m.model!,
                  latencyMs: m.latencyMs!,
                }
              : undefined,
        })),
      );
    } catch {}
  };

  const saveTopic = async () => {
    if (!editingId || !editValue.trim()) return;
    await updateTopic(editingId, editValue.trim());
    setConversations((p) =>
      p.map((c) =>
        c.id === editingId ? { ...c, topic: editValue.trim() } : c,
      ),
    );
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć konwersację?")) return;
    await deleteConversation(id);
    setConversations((p) => p.filter((c) => c.id !== id));
    if (convId === id) newConv();
    if (detailConv?.id === id) setDetailConv(null);
    refreshSidebar();
  };

  const isProcessing = state === "processing" || state === "researching";

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarOpen ? "w-80" : "w-0"} shrink-0 bg-surface-1 border-r border-surface-3 flex flex-col transition-all duration-200 overflow-hidden`}
      >
        <div className="p-4 border-b border-surface-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white tracking-tight">
              Smart Omni
            </h1>
            <button
              onClick={newConv}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              + Nowa
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj we wszystkich..."
              className="w-full bg-surface-2 border border-surface-4 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {stats && !searchResults && (
          <div className="grid grid-cols-4 gap-1 px-4 py-2.5 border-b border-surface-3 text-center">
            <StatMini label="Konw." value={stats.totalConversations} />
            <StatMini label="Wiad." value={stats.totalMessages} />
            <StatMini label="Tokeny" value={fmtTokens(stats.tokens.total)} />
            <StatMini
              label="Koszt"
              value={`$${stats.totalCostUsd.toFixed(2)}`}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {searchResults ? (
            <SearchResultsView
              results={searchResults}
              onOpenConv={openDetail}
            />
          ) : (
            conversations.map((c) => (
              <ConvItem
                key={c.id}
                conv={c}
                active={convId === c.id}
                editing={editingId === c.id}
                editValue={editValue}
                onEditChange={setEditValue}
                onEditSave={saveTopic}
                onStartEdit={() => {
                  setEditingId(c.id);
                  setEditValue(c.topic);
                }}
                onClick={() => openDetail(c.id)}
                onContinue={() => continueConv(c.id)}
                onDelete={() => handleDelete(c.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 px-4 flex items-center justify-between border-b border-surface-3 bg-surface-1/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {sidebarOpen ? "◀" : "▶"}
            </button>
            {detailConv ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDetailConv(null)}
                  className="text-accent text-sm hover:underline"
                >
                  ← Chat
                </button>
                <span className="text-gray-500">|</span>
                <span className="text-white font-medium truncate max-w-xs">
                  {detailConv.topic}
                </span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">
                {convId ? "Konwersacja aktywna" : "Nowa konwersacja"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={newConv}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-glow text-surface-0 text-xs font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-accent/20"
            >
              <span className="text-sm">✦</span> Nowa rozmowa
            </button>
            {!sttAvailable && (
              <span className="text-xs text-yellow-500/70 bg-yellow-500/10 px-2 py-1 rounded">
                Brak mikrofonu
              </span>
            )}
            <button
              onClick={onLogout}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
              title="Wyloguj"
            >
              ⏻
            </button>
          </div>
        </header>

        {/* Content */}
        {detailConv ? (
          <DetailView
            conv={detailConv}
            search={detailSearch}
            onSearchChange={setDetailSearch}
            onContinue={() => continueConv(detailConv.id)}
          />
        ) : (
          <>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-3">
                {log.length === 0 && <EmptyState />}
                {log.map((e) => (
                  <ChatBubble key={e.id} entry={e} />
                ))}

                {/* Live status */}
                {isProcessing && (
                  <div className="animate-fade-in bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-purple-300">
                        {liveStatus ||
                          (state === "researching"
                            ? "Analizuję zapytanie..."
                            : "Przetwarzam...")}
                      </span>
                    </div>
                  </div>
                )}

                {state === "listening" && transcript && (
                  <div className="animate-fade-in text-accent/70 italic text-sm pl-4 border-l-2 border-accent/30">
                    {transcript}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input area */}
            <div className="shrink-0 border-t border-surface-3 bg-surface-1/50 backdrop-blur-sm">
              <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                <button
                  onClick={toggleVoice}
                  disabled={isProcessing || !sttAvailable}
                  className="relative shrink-0 group"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                      state === "listening"
                        ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/40"
                        : state === "speaking"
                          ? "bg-accent/20 text-accent"
                          : isProcessing
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-surface-3 text-gray-400 hover:bg-surface-4 hover:text-white"
                    } ${!sttAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {state === "listening" && (
                      <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring" />
                    )}
                    <span className="text-xl relative z-10">
                      {state === "listening"
                        ? "⏹"
                        : state === "speaking"
                          ? "🔊"
                          : isProcessing
                            ? "🔍"
                            : "🎤"}
                    </span>
                  </div>
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={
                    state === "listening" ? "Słucham..." : "Wpisz komendę..."
                  }
                  disabled={isProcessing}
                  className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 disabled:opacity-50 transition-colors"
                />

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isProcessing}
                  className="shrink-0 w-10 h-10 rounded-xl bg-accent text-surface-0 font-bold text-lg flex items-center justify-center hover:bg-accent-glow transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
              </div>
              <div className="max-w-3xl mx-auto px-4 pb-2 flex items-center justify-between">
                {/* Model picker */}
                <div className="flex items-center gap-2">
                  {(["claude-haiku-4-5", "claude-sonnet-4-6"] as ModelId[]).map(
                    (m) => (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border ${
                          model === m
                            ? "bg-accent/15 border-accent/40 text-accent"
                            : "bg-transparent border-surface-4 text-gray-600 hover:border-gray-500 hover:text-gray-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${model === m ? "bg-accent" : "bg-gray-600"}`}
                        />
                        {m === "claude-haiku-4-5" ? "Haiku 4.5" : "Sonnet 4.6"}
                        <span
                          className={`text-[9px] ${model === m ? "text-accent/60" : "text-gray-700"}`}
                        >
                          {m === "claude-haiku-4-5" ? "szybki" : "smart"}
                        </span>
                      </button>
                    ),
                  )}
                </div>

                {/* Status */}
                <p className="text-[10px] text-gray-600 font-mono">
                  {state === "listening" && "🔴 nasłuchuję..."}
                  {isProcessing &&
                    (liveStatus
                      ? `🔍 ${liveStatus.slice(0, 50)}`
                      : "⏳ przetwarzam...")}
                  {state === "speaking" && "🔊 mówię — kliknij 🎤 aby przerwać"}
                  {state === "idle" &&
                    (sttAvailable ? "🎤 lub Enter" : "Enter")}
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sub-components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-200">{value}</div>
      <div className="text-[9px] text-gray-500">{label}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 animate-fade-in">
      <div className="text-5xl mb-4">🎤</div>
      <h2 className="text-xl font-semibold text-gray-300 mb-2">Smart Omni</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
        Głosowy asystent AI z automatycznym researchem online.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm mx-auto text-left">
        {[
          "Utwórz kartę w Trello: naprawić buga",
          "Jakie są najnowsze modele Claude?",
          "Porównaj React vs Vue w 2026",
          "Co mam w kalendarzu?",
        ].map((ex) => (
          <div
            key={ex}
            className="text-xs text-gray-500 bg-surface-2 rounded-lg px-3 py-2 border border-surface-3"
          >
            „{ex}"
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ entry }: { entry: LogEntry }) {
  const [showStats, setShowStats] = useState(false);
  const isUser = entry.type === "user";

  if (entry.type === "research-status") {
    const lines = entry.text.split("\n").filter(Boolean);
    return (
      <div className="animate-slide-up bg-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3 text-xs space-y-1">
        <div className="text-purple-400 font-medium mb-1">
          🔍 Proces wyszukiwania
        </div>
        {lines.map((l, i) => (
          <div key={i} className="text-purple-300/80">
            {l}
          </div>
        ))}
      </div>
    );
  }

  if (entry.type === "action" || entry.type === "error") {
    return (
      <div
        className={`animate-slide-up text-xs font-mono px-3 py-1.5 rounded-lg ${
          entry.type === "error"
            ? "bg-red-500/10 text-red-400"
            : "bg-emerald-500/10 text-emerald-400"
        }`}
      >
        {entry.text}
      </div>
    );
  }

  return (
    <div
      className={`animate-slide-up flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        onClick={() => entry.stats && setShowStats(!showStats)}
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-accent/15 text-gray-100 rounded-br-md"
            : "bg-surface-2 text-gray-200 rounded-bl-md border border-surface-3"
        } ${entry.stats ? "cursor-pointer" : ""}`}
      >
        {entry.didResearch && !isUser && (
          <div className="text-[10px] text-purple-400 font-medium mb-1">
            🔍 Odpowiedź z researchu
          </div>
        )}

        <div className="text-sm leading-relaxed">
          <RenderedMarkdown text={entry.text} sources={entry.sources} />
        </div>

        {/* Sources bibliography */}
        {entry.sources && entry.sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-surface-4">
            <div className="text-[10px] text-gray-500 font-medium mb-1.5">
              📚 Źródła
            </div>
            {entry.sources.map((s) => (
              <a
                key={s.index}
                href={s.url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-2 py-1 text-[11px] hover:bg-surface-3/50 rounded px-1 -mx-1 transition-colors group no-underline"
              >
                <span className="text-accent font-bold shrink-0">
                  [{s.index}]
                </span>
                <span className="text-gray-400 truncate group-hover:text-gray-200 transition-colors">
                  {s.title}
                </span>
                <span className="text-gray-600 ml-auto shrink-0">↗</span>
              </a>
            ))}
          </div>
        )}

        {showStats && entry.stats && (
          <div className="mt-2 pt-2 border-t border-surface-4 text-[10px] font-mono text-gray-500 space-y-0.5">
            <div>
              {entry.stats.inputTokens} in + {entry.stats.outputTokens} out ={" "}
              {entry.stats.totalTokens} tok
            </div>
            <div>
              ${entry.stats.costUsd.toFixed(5)} · {entry.stats.latencyMs}ms ·{" "}
              {entry.stats.model}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-1">
          <span className="text-[10px] text-gray-600">
            {entry.time.toLocaleTimeString("pl-PL", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {entry.stats && (
            <span className="text-[10px] font-mono text-gray-600">
              ${entry.stats.costUsd.toFixed(5)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConvItem({
  conv,
  active,
  editing,
  editValue,
  onEditChange,
  onEditSave,
  onStartEdit,
  onClick,
  onContinue,
  onDelete,
}: {
  conv: ConversationSummary;
  active: boolean;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onStartEdit: () => void;
  onClick: () => void;
  onContinue: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`px-4 py-3 border-b border-surface-3/50 hover:bg-surface-2/50 transition-colors ${active ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}
    >
      {editing ? (
        <input
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEditSave()}
          onBlur={onEditSave}
          autoFocus
          className="w-full bg-surface-0 border border-accent/50 rounded px-2 py-1 text-sm text-white focus:outline-none"
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onClick}
              className="text-sm font-medium text-gray-200 hover:text-white truncate text-left flex-1"
            >
              {conv.topic || "Nowa konwersacja"}
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onStartEdit}
                className="text-gray-600 hover:text-gray-300 text-xs p-0.5"
                title="Edytuj"
              >
                ✏️
              </button>
              <button
                onClick={onDelete}
                className="text-gray-600 hover:text-red-400 text-xs p-0.5"
                title="Usuń"
              >
                🗑
              </button>
            </div>
          </div>
          {conv.lastMessage && (
            <p className="text-xs text-gray-500 truncate mt-1">
              {conv.lastMessage.role === "user" ? "🗣️ " : "🤖 "}
              {conv.lastMessage.content}
            </p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-3 text-[10px] font-mono text-gray-600">
              <span>{conv.messageCount} wiad.</span>
              <span>
                {(
                  conv.totalInputTokens + conv.totalOutputTokens
                ).toLocaleString()}{" "}
                tok
              </span>
              <span>${conv.totalCostUsd.toFixed(4)}</span>
            </div>
            <button
              onClick={onContinue}
              className="text-[10px] text-accent hover:text-accent-glow font-medium"
            >
              Kontynuuj ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SearchResultsView({
  results,
  onOpenConv,
}: {
  results: SearchResult;
  onOpenConv: (id: string) => void;
}) {
  return (
    <div className="p-3 space-y-4">
      {results.conversationResults.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Konwersacje ({results.conversationResults.length})
          </h3>
          {results.conversationResults.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpenConv(c.id)}
              className="w-full text-left px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 mb-1.5 transition-colors"
            >
              <div className="text-sm text-gray-200">{c.topic}</div>
              <div className="text-[10px] text-gray-500">
                {c.messageCount} wiad.
              </div>
            </button>
          ))}
        </div>
      )}
      <div>
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Wiadomości ({results.messageResults.pagination.total})
        </h3>
        {results.messageResults.messages.map((m) => (
          <button
            key={m.id}
            onClick={() => onOpenConv(m.conversationId)}
            className="w-full text-left px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 mb-1.5 transition-colors"
          >
            <div className="text-[10px] text-accent font-medium">
              {m.conversationTopic}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
              {m.role === "user" ? "🗣️ " : "🤖 "}
              {m.matchContext}
            </div>
          </button>
        ))}
        {results.messageResults.messages.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">Brak wyników</p>
        )}
      </div>
    </div>
  );
}

function DetailView({
  conv,
  search,
  onSearchChange,
  onContinue,
}: {
  conv: ConversationDetail;
  search: string;
  onSearchChange: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-surface-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-[11px] font-mono text-gray-500">
          <span>{conv.stats.messageCount} wiad.</span>
          <span>{conv.stats.totalTokens.toLocaleString()} tok</span>
          <span>${conv.stats.totalCostUsd.toFixed(4)}</span>
          <span>{new Date(conv.createdAt).toLocaleDateString("pl-PL")}</span>
        </div>
        <button
          onClick={onContinue}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          Kontynuuj ▶
        </button>
      </div>
      <div className="shrink-0 px-4 py-2 border-b border-surface-3">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Szukaj w tej konwersacji..."
          className="w-full bg-surface-2 border border-surface-4 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {conv.messages.map((m) => (
            <DetailBubble key={m.id} msg={m} />
          ))}
          {conv.messages.length === 0 && (
            <p className="text-sm text-gray-600 text-center py-10">
              Brak wyników
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBubble({ msg }: { msg: Message }) {
  const [open, setOpen] = useState(false);
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        onClick={() => !isUser && setOpen(!open)}
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isUser ? "bg-accent/15 text-gray-100 rounded-br-md" : "bg-surface-2 text-gray-200 rounded-bl-md border border-surface-3 cursor-pointer"}`}
      >
        <div className="text-sm leading-relaxed">
          <RenderedMarkdown text={msg.content} />
        </div>
        {open && !isUser && (
          <div className="mt-2 pt-2 border-t border-surface-4 text-[10px] font-mono text-gray-500 space-y-0.5">
            {msg.inputTokens != null && (
              <div>
                In: {msg.inputTokens} | Out: {msg.outputTokens} | Σ:{" "}
                {msg.totalTokens}
              </div>
            )}
            {msg.costUsd != null && (
              <div>
                ${msg.costUsd.toFixed(5)} | {msg.latencyMs}ms | {msg.model}
              </div>
            )}
            {msg.thinking && (
              <div className="text-yellow-500/70">💭 {msg.thinking}</div>
            )}
          </div>
        )}
        <div className="text-[10px] text-gray-600 text-right mt-1">
          {new Date(msg.createdAt).toLocaleTimeString("pl-PL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {msg.costUsd != null && ` · $${msg.costUsd.toFixed(5)}`}
        </div>
      </div>
    </div>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
