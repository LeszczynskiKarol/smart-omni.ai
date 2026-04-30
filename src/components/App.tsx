import { useState, useEffect, useRef, useCallback } from "react";
import {
  sendVoice,
  getConversations,
  getConversation,
  globalSearch,
  getStats,
  updateTopic,
  deleteConversation,
  type VoiceResponse,
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

type AppState = "idle" | "listening" | "processing" | "speaking";

interface LogEntry {
  id: string;
  type: "user" | "assistant" | "action" | "error";
  text: string;
  time: Date;
  stats?: Stats;
  actions?: VoiceResponse["actions"];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// App
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function App() {
  // View state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailConv, setDetailConv] = useState<ConversationDetail | null>(null);
  const [detailSearch, setDetailSearch] = useState("");

  // Chat state
  const [state, setState] = useState<AppState>("idle");
  const [convId, setConvId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState("");

  // Sidebar state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [stats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);

  // ── Load conversations ──

  const refreshSidebar = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([getConversations(), getStats()]);
      setConversations(c.conversations);
      setGlobalStats(s);
    } catch {}
  }, []);

  useEffect(() => { refreshSidebar(); }, []);

  // ── Auto-scroll chat ──

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log.length]);

  // ── Global search (debounced) ──

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

  // ── Detail search (debounced) ──

  useEffect(() => {
    if (!detailConv) return;
    if (detailSearch.trim().length < 2) {
      // Reload full
      getConversation(detailConv.id).then(setDetailConv).catch(() => {});
      return;
    }
    const t = setTimeout(async () => {
      try {
        setDetailConv(await getConversation(detailConv.id, detailSearch.trim()));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [detailSearch]);

  // ── Add log entry ──

  const addLog = (type: LogEntry["type"], text: string, stats?: Stats, actions?: VoiceResponse["actions"]) => {
    setLog((p) => [...p, {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      type, text, time: new Date(), stats, actions,
    }]);
  };

  // ── Process text (voice or keyboard) ──

  const processText = async (text: string) => {
    if (!text.trim() || state === "processing") return;
    addLog("user", text);
    setState("processing");

    try {
      const res = await sendVoice(text, convId || undefined);
      if (res.conversationId) setConvId(res.conversationId);

      addLog("assistant", res.response, res.stats, res.actions);

      for (const a of res.actions || []) {
        if (a.status === "success") addLog("action", `✅ ${a.action}: ${JSON.stringify(a.result).slice(0, 120)}`);
        else if (a.status === "error") addLog("error", `❌ ${a.action}: ${a.error}`);
      }

      // TTS
      if (ttsAvailable) {
        setState("speaking");
        await speak(res.response);
      }

      setState("idle");
      refreshSidebar();
    } catch (err: any) {
      addLog("error", `Błąd: ${err.message}`);
      setState("idle");
    }
  };

  // ── Voice ──

  const startListening = () => {
    if (!sttAvailable) return;
    stopSpeaking();
    setTranscript("");
    setState("listening");

    const rec = createRecognizer({
      onResult: (t) => { setTranscript(""); recRef.current = null; processText(t); },
      onPartial: (t) => setTranscript(t),
      onEnd: () => { if (state === "listening") setState("idle"); },
      onError: (e) => { addLog("error", `STT: ${e}`); setState("idle"); },
    });

    if (rec) { recRef.current = rec; rec.start(); }
  };

  const stopListening = () => {
    if (recRef.current) { recRef.current.stop(); recRef.current = null; }
  };

  const toggleVoice = () => {
    if (state === "listening") stopListening();
    else if (state === "idle") startListening();
    else if (state === "speaking") { stopSpeaking(); setState("idle"); }
  };

  // ── Keyboard send ──

  const handleSend = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    processText(t);
  };

  // ── New conversation ──

  const newConv = () => {
    setConvId(null);
    setLog([]);
    setDetailConv(null);
    inputRef.current?.focus();
  };

  // ── Open conversation detail ──

  const openDetail = async (id: string) => {
    try {
      const d = await getConversation(id);
      setDetailConv(d);
      setDetailSearch("");
    } catch {}
  };

  // ── Continue conversation (load into chat) ──

  const continueConv = async (id: string) => {
    try {
      const d = await getConversation(id);
      setConvId(d.id);
      setDetailConv(null);
      const entries: LogEntry[] = d.messages.map((m, i) => ({
        id: `l${i}${Date.now().toString(36)}`,
        type: m.role as any,
        text: m.content,
        time: new Date(m.createdAt),
        stats: m.inputTokens != null ? {
          inputTokens: m.inputTokens!, outputTokens: m.outputTokens!,
          totalTokens: m.totalTokens!, costUsd: m.costUsd!,
          model: m.model!, latencyMs: m.latencyMs!,
        } : undefined,
      }));
      setLog(entries);
    } catch {}
  };

  // ── Topic edit ──

  const saveTopic = async () => {
    if (!editingId || !editValue.trim()) return;
    await updateTopic(editingId, editValue.trim());
    setConversations((p) => p.map((c) =>
      c.id === editingId ? { ...c, topic: editValue.trim() } : c
    ));
    setEditingId(null);
  };

  // ── Delete ──

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć konwersację?")) return;
    await deleteConversation(id);
    setConversations((p) => p.filter((c) => c.id !== id));
    if (convId === id) newConv();
    if (detailConv?.id === id) setDetailConv(null);
    refreshSidebar();
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className={`${sidebarOpen ? "w-80" : "w-0"} shrink-0 bg-surface-1 border-r border-surface-3 flex flex-col transition-all duration-200 overflow-hidden`}>
        {/* Sidebar header */}
        <div className="p-4 border-b border-surface-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white tracking-tight">Smart Omni</h1>
            <button onClick={newConv} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
              + Nowa
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj we wszystkich..."
              className="w-full bg-surface-2 border border-surface-4 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm">✕</button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && !searchResults && (
          <div className="grid grid-cols-4 gap-1 px-4 py-2.5 border-b border-surface-3 text-center">
            <StatMini label="Konw." value={stats.totalConversations} />
            <StatMini label="Wiad." value={stats.totalMessages} />
            <StatMini label="Tokeny" value={fmtTokens(stats.tokens.total)} />
            <StatMini label="Koszt" value={`$${stats.totalCostUsd.toFixed(2)}`} />
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {searchResults ? (
            <SearchResults
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
                onStartEdit={() => { setEditingId(c.id); setEditValue(c.topic); }}
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
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white transition-colors">
              {sidebarOpen ? "◀" : "▶"}
            </button>
            {detailConv ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setDetailConv(null)} className="text-accent text-sm hover:underline">← Chat</button>
                <span className="text-gray-500">|</span>
                <span className="text-white font-medium truncate max-w-xs">{detailConv.topic}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-400">
                {convId ? "Konwersacja aktywna" : "Nowa konwersacja"}
              </span>
            )}
          </div>
          {!sttAvailable && (
            <span className="text-xs text-yellow-500/70 bg-yellow-500/10 px-2 py-1 rounded">
              Przeglądarka nie obsługuje mikrofonu
            </span>
          )}
        </header>

        {/* Content area */}
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
                {log.map((e) => <ChatBubble key={e.id} entry={e} />)}
                {state === "listening" && transcript && (
                  <div className="animate-fade-in text-accent/70 italic text-sm pl-4 border-l-2 border-accent/30">{transcript}</div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input area */}
            <div className="shrink-0 border-t border-surface-3 bg-surface-1/50 backdrop-blur-sm">
              <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                {/* Voice button */}
                <button
                  onClick={toggleVoice}
                  disabled={state === "processing" || !sttAvailable}
                  className="relative shrink-0 group"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                    state === "listening"
                      ? "bg-red-500/20 text-red-400 ring-2 ring-red-500/40"
                      : state === "speaking"
                        ? "bg-accent/20 text-accent"
                        : state === "processing"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-surface-3 text-gray-400 hover:bg-surface-4 hover:text-white"
                  } ${!sttAvailable ? "opacity-40 cursor-not-allowed" : ""}`}>
                    {state === "listening" && (
                      <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring" />
                    )}
                    <span className="text-xl relative z-10">
                      {state === "listening" ? "⏹" : state === "speaking" ? "🔊" : state === "processing" ? "⏳" : "🎤"}
                    </span>
                  </div>
                </button>

                {/* Text input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={state === "listening" ? "Słucham..." : "Wpisz komendę..."}
                  disabled={state === "processing"}
                  className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 disabled:opacity-50 transition-colors"
                />

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || state === "processing"}
                  className="shrink-0 w-10 h-10 rounded-xl bg-accent text-surface-0 font-bold text-lg flex items-center justify-center hover:bg-accent-glow transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ↑
                </button>
              </div>

              {/* Status bar */}
              <div className="max-w-3xl mx-auto px-4 pb-2">
                <p className="text-[10px] text-gray-600 font-mono">
                  {state === "listening" && "🔴 nasłuchuję..."}
                  {state === "processing" && "⏳ przetwarzam..."}
                  {state === "speaking" && "🔊 mówię — kliknij mikrofon aby przerwać"}
                  {state === "idle" && (sttAvailable ? "kliknij 🎤 lub wpisz komendę" : "wpisz komendę i naciśnij Enter")}
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
        Głosowy asystent AI. Kliknij mikrofon lub wpisz komendę.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm mx-auto text-left">
        {[
          "Utwórz kartę w Trello: naprawić buga",
          "Wyślij maila do Jana z raportem",
          "Dodaj wydarzenie jutro o 14",
          "Co mam w kalendarzu?",
        ].map((ex) => (
          <div key={ex} className="text-xs text-gray-500 bg-surface-2 rounded-lg px-3 py-2 border border-surface-3">
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
  const isAction = entry.type === "action";
  const isError = entry.type === "error";

  if (isAction || isError) {
    return (
      <div className={`animate-slide-up text-xs font-mono px-3 py-1.5 rounded-lg ${
        isError ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
      }`}>
        {entry.text}
      </div>
    );
  }

  return (
    <div className={`animate-slide-up flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        onClick={() => entry.stats && setShowStats(!showStats)}
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-accent/15 text-gray-100 rounded-br-md"
            : "bg-surface-2 text-gray-200 rounded-bl-md border border-surface-3"
        } ${entry.stats ? "cursor-pointer" : ""}`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</p>

        {showStats && entry.stats && (
          <div className="mt-2 pt-2 border-t border-surface-4 text-[10px] font-mono text-gray-500 space-y-0.5">
            <div>{entry.stats.inputTokens} in + {entry.stats.outputTokens} out = {entry.stats.totalTokens} tok</div>
            <div>${entry.stats.costUsd.toFixed(5)} · {entry.stats.latencyMs}ms · {entry.stats.model}</div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-1">
          <span className="text-[10px] text-gray-600">
            {entry.time.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {entry.stats && (
            <span className="text-[10px] font-mono text-gray-600">${entry.stats.costUsd.toFixed(5)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConvItem({ conv, active, editing, editValue, onEditChange, onEditSave, onStartEdit, onClick, onContinue, onDelete }: {
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
    <div className={`px-4 py-3 border-b border-surface-3/50 hover:bg-surface-2/50 transition-colors ${active ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}>
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
            <button onClick={onClick} className="text-sm font-medium text-gray-200 hover:text-white truncate text-left flex-1">
              {conv.topic || "Nowa konwersacja"}
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onStartEdit} className="text-gray-600 hover:text-gray-300 text-xs p-0.5" title="Edytuj temat">✏️</button>
              <button onClick={onDelete} className="text-gray-600 hover:text-red-400 text-xs p-0.5" title="Usuń">🗑</button>
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
              <span>{(conv.totalInputTokens + conv.totalOutputTokens).toLocaleString()} tok</span>
              <span>${conv.totalCostUsd.toFixed(4)}</span>
            </div>
            <button onClick={onContinue} className="text-[10px] text-accent hover:text-accent-glow font-medium">
              Kontynuuj ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SearchResults({ results, onOpenConv }: { results: SearchResult; onOpenConv: (id: string) => void }) {
  return (
    <div className="p-3 space-y-4">
      {results.conversationResults.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Konwersacje ({results.conversationResults.length})</h3>
          {results.conversationResults.map((c) => (
            <button key={c.id} onClick={() => onOpenConv(c.id)} className="w-full text-left px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 mb-1.5 transition-colors">
              <div className="text-sm text-gray-200">{c.topic}</div>
              <div className="text-[10px] text-gray-500">{c.messageCount} wiad.</div>
            </button>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Wiadomości ({results.messageResults.pagination.total})
        </h3>
        {results.messageResults.messages.map((m) => (
          <button key={m.id} onClick={() => onOpenConv(m.conversationId)} className="w-full text-left px-3 py-2 rounded-lg bg-surface-2 hover:bg-surface-3 mb-1.5 transition-colors">
            <div className="text-[10px] text-accent font-medium">{m.conversationTopic}</div>
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

function DetailView({ conv, search, onSearchChange, onContinue }: {
  conv: ConversationDetail;
  search: string;
  onSearchChange: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Detail header */}
      <div className="shrink-0 px-4 py-3 border-b border-surface-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-[11px] font-mono text-gray-500">
          <span>{conv.stats.messageCount} wiad.</span>
          <span>{conv.stats.totalTokens.toLocaleString()} tok</span>
          <span>${conv.stats.totalCostUsd.toFixed(4)}</span>
          <span>{new Date(conv.createdAt).toLocaleDateString("pl-PL")}</span>
        </div>
        <button onClick={onContinue} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
          Kontynuuj ▶
        </button>
      </div>

      {/* Search in conversation */}
      <div className="shrink-0 px-4 py-2 border-b border-surface-3">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Szukaj w tej konwersacji..."
          className="w-full bg-surface-2 border border-surface-4 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {conv.messages.map((m) => (
            <DetailBubble key={m.id} msg={m} />
          ))}
          {conv.messages.length === 0 && (
            <p className="text-sm text-gray-600 text-center py-10">Brak wyników</p>
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
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-accent/15 text-gray-100 rounded-br-md"
            : "bg-surface-2 text-gray-200 rounded-bl-md border border-surface-3 cursor-pointer"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

        {open && !isUser && (
          <div className="mt-2 pt-2 border-t border-surface-4 text-[10px] font-mono text-gray-500 space-y-0.5">
            {msg.inputTokens != null && <div>In: {msg.inputTokens} | Out: {msg.outputTokens} | Σ: {msg.totalTokens}</div>}
            {msg.costUsd != null && <div>${msg.costUsd.toFixed(5)} | {msg.latencyMs}ms | {msg.model}</div>}
            {msg.thinking && <div className="text-yellow-500/70">💭 {msg.thinking}</div>}
            {msg.actions && Array.isArray(msg.actions) && msg.actions.length > 0 && (
              <div>Akcje: {(msg.actions as any[]).map((a: any) => `${a.action}(${a.status})`).join(", ")}</div>
            )}
          </div>
        )}

        <div className="text-[10px] text-gray-600 text-right mt-1">
          {new Date(msg.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
          {msg.costUsd != null && ` · $${msg.costUsd.toFixed(5)}`}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
