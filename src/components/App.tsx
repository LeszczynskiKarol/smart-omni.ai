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
  uploadFiles,
  type ProcessedFile,
} from "../lib/api";
import {
  createRecognizer,
  speak,
  stopSpeaking,
  sttAvailable,
  ttsAvailable,
} from "../lib/speech";
import CodeBlock, { InlineCode } from "./CodeBlock";

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
  thinking?: string;
  attachedFiles?: {
    filename: string;
    mimeType: string;
    s3Key: string;
    size: number;
    processingMethod: string;
    previewUrl?: string;
  }[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Markdown renderer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderInline(text: string, sources?: Source[]): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(\d+)\]|`([^`]+)`)/g;
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
    } else if (m[5]) {
      parts.push(<InlineCode key={`c${i++}`}>{m[5]}</InlineCode>);
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
  // Parse code blocks first, then render text segments with inline markdown
  const segments = parseCodeBlocks(text);

  return (
    <div className="space-y-1">
      {segments.map((seg, si) => {
        if (seg.type === "code") {
          return (
            <CodeBlock
              key={si}
              code={seg.content}
              language={seg.language}
              filename={seg.filename}
            />
          );
        }
        // Text segment — render line by line
        const lines = seg.content.split("\n");
        return (
          <div key={si} className="space-y-1">
            {lines.map((line, li) => {
              const h3 = line.match(/^###\s+(.+)/);
              const h2 = !h3 && line.match(/^##\s+(.+)/);
              const h1 = !h2 && !h3 && line.match(/^#\s+(.+)/);
              const bullet = line.match(/^[-•]\s+(.+)/);
              const numbered = line.match(/^(\d+)\.\s+(.+)/);

              if (h3)
                return (
                  <h4
                    key={li}
                    className="text-sm font-semibold text-gray-200 mt-2"
                  >
                    {renderInline(h3[1], sources)}
                  </h4>
                );
              if (h2)
                return (
                  <h3
                    key={li}
                    className="text-[15px] font-bold text-gray-100 mt-3"
                  >
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
      })}
    </div>
  );
}

// Parse text into segments: text blocks and code blocks
function parseCodeBlocks(text: string): {
  type: "text" | "code";
  content: string;
  language?: string;
  filename?: string;
}[] {
  const segments: {
    type: "text" | "code";
    content: string;
    language?: string;
    filename?: string;
  }[] = [];
  const re = /```(\w*)?(?:\s+(\S+))?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index).trim();
      if (textBefore) segments.push({ type: "text", content: textBefore });
    }

    // Code block
    const language = match[1] || undefined;
    const filename = match[2] || undefined;
    const code = match[3].replace(/\n$/, ""); // trim trailing newline
    segments.push({ type: "code", content: code, language, filename });

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) segments.push({ type: "text", content: remaining });
  }

  // If no code blocks found, return as single text segment
  if (segments.length === 0) {
    segments.push({ type: "text", content: text });
  }

  return segments;
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
  const [convId, setConvId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("conv");
  });
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Map<string, string>>(
    new Map(),
  );
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const processingRef = useRef(false);

  const refreshSidebar = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([getConversations(), getStats()]);
      setConversations(c.conversations);
      setGlobalStats(s);
    } catch {}
  }, []);

  // ── File handling ──
  const addFiles = (files: File[]) => {
    const valid = files.filter((f) => f.size <= 20 * 1024 * 1024);
    setPendingFiles((prev) => [...prev, ...valid].slice(0, 5));
    // Generate previews for images
    valid.forEach((f) => {
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () =>
          setFilePreviews((prev) =>
            new Map(prev).set(f.name, reader.result as string),
          );
        reader.readAsDataURL(f);
      }
    });
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  useEffect(() => {
    refreshSidebar();
  }, []);

  // Sync convId ↔ URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (convId) {
      url.searchParams.set("conv", convId);
    } else {
      url.searchParams.delete("conv");
    }
    window.history.replaceState({}, "", url.toString());
  }, [convId]);

  // Load conversation from URL on mount
  useEffect(() => {
    if (convId && log.length === 0) {
      continueConv(convId);
    }
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
    attachedFiles?: LogEntry["attachedFiles"],
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
        attachedFiles,
      },
    ]);
  };

  // ── Process text with streaming ──

  const processText = async (text: string) => {
    if (!text.trim() || processingRef.current) return;
    processingRef.current = true;

    // Upload plików jeśli są
    let attachments: ProcessedFile[] | undefined;
    if (pendingFiles.length > 0) {
      setUploadingFiles(true);
      try {
        const result = await uploadFiles(pendingFiles);
        attachments = result.files;
        console.log(`📎 Uploaded ${attachments.length} files`);
      } catch (err: any) {
        addLog("error", `Błąd uploadu: ${err.message}`);
        setUploadingFiles(false);
        return;
      }
      setUploadingFiles(false);
      setPendingFiles([]);
      setFilePreviews(new Map());
    }

    // Log z info o plikach
    const savedPreviews = new Map(filePreviews);
    setUploadingFiles(false);

    addLog(
      "user",
      text,
      undefined,
      undefined,
      undefined,
      undefined,
      attachments?.map((a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        s3Key: a.s3Key,
        size: a.size,
        processingMethod: a.processingMethod,
        previewUrl: savedPreviews.get(a.filename),
      })),
    );

    setPendingFiles([]);
    setFilePreviews(new Map());

    setState("researching");
    setLiveStatus("");

    try {
      let res: VoiceResponse;
      const statusMessages: string[] = [];

      res = await sendVoiceStreaming(
        text,
        convId || undefined,
        model,
        (msg) => {
          setLiveStatus(msg);
          statusMessages.push(msg);
        },
        attachments,
      );

      if (res.conversationId) setConvId(res.conversationId);

      if (res.didResearch && statusMessages.length > 0) {
        addLog("research-status", statusMessages.join("\n"));
      }

      const entry = addLog(
        "assistant",
        res.response,
        res.stats,
        res.actions,
        res.sources,
        res.didResearch,
      );
      // Dodaj thinking do ostatniego wpisu
      if (res.thinking) {
        setLog((prev) =>
          prev.map((e, i) =>
            i === prev.length - 1 ? { ...e, thinking: res.thinking } : e,
          ),
        );
      }

      for (const a of res.actions || []) {
        if (a.status === "success")
          addLog(
            "action",
            `✅ ${a.action}: ${JSON.stringify({ ...a.params, ...a.result }).slice(0, 800)}`,
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
    } finally {
      processingRef.current = false;
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
    setPendingFiles([]);
    setFilePreviews(new Map());
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

      const entries: LogEntry[] = [];
      for (const m of d.messages) {
        entries.push({
          id: `l${entries.length}${Date.now().toString(36)}`,
          type: m.role as any,
          text: m.content,
          time: new Date(m.createdAt),
          actions: m.actions as any,
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
        });

        // Odtwórz wpisy akcji z pola actions wiadomości asystenta
        if (m.role === "assistant" && Array.isArray(m.actions)) {
          for (const a of m.actions as any[]) {
            if (a.status === "success") {
              entries.push({
                id: `a${entries.length}${Date.now().toString(36)}`,
                type: "action",
                text: `✅ ${a.action}: ${JSON.stringify({ ...a.params, ...a.result }).slice(0, 800)}`,
                time: new Date(m.createdAt),
              });
            } else if (a.status === "error") {
              entries.push({
                id: `e${entries.length}${Date.now().toString(36)}`,
                type: "error",
                text: `❌ ${a.action}: ${a.error}`,
                time: new Date(m.createdAt),
              });
            }
          }
        }
      }
      setLog(entries);
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
            <div
              className="flex-1 overflow-y-auto px-4 py-6 relative"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {/* Drop overlay */}
              {dragOver && (
                <div className="absolute inset-0 z-50 bg-accent/10 backdrop-blur-sm border-2 border-dashed border-accent/40 rounded-2xl flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📎</div>
                    <div className="text-accent font-medium">
                      Upuść pliki tutaj
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      PDF, DOCX, obrazy, tekst · max 20MB
                    </div>
                  </div>
                </div>
              )}

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
              {/* Pending files */}
              {pendingFiles.length > 0 && (
                <div className="max-w-3xl mx-auto px-4 pt-2 flex items-center gap-2 flex-wrap">
                  {pendingFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-surface-2 border border-surface-4 rounded-lg px-2.5 py-1.5 group animate-fade-in"
                    >
                      {filePreviews.get(f.name) ? (
                        <img
                          src={filePreviews.get(f.name)}
                          alt=""
                          className="w-6 h-6 rounded object-cover"
                        />
                      ) : (
                        <span className="text-sm">
                          {f.type.includes("pdf")
                            ? "📄"
                            : f.type.includes("word") ||
                                f.type.includes("document")
                              ? "📝"
                              : f.type.startsWith("image/")
                                ? "🖼️"
                                : "📃"}
                        </span>
                      )}
                      <span className="text-xs text-gray-300 max-w-[120px] truncate">
                        {f.name}
                      </span>
                      <span className="text-[9px] text-gray-600">
                        {(f.size / 1024).toFixed(0)}KB
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-gray-600 hover:text-red-400 text-xs ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {uploadingFiles && (
                    <div className="flex items-center gap-2 text-xs text-accent animate-fade-in">
                      <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Przesyłam...
                    </div>
                  )}
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.csv,.md,.html,.json,.xml,.png,.jpg,.jpeg,.gif,.webp"
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files || []));
                  e.target.value = "";
                }}
              />

              <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                {/* Attach button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className={`relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    pendingFiles.length > 0
                      ? "bg-accent/20 text-accent"
                      : "bg-surface-3 text-gray-500 hover:bg-surface-4 hover:text-gray-300"
                  } disabled:opacity-40`}
                  title="Załącz plik"
                >
                  <span className="text-lg">📎</span>
                  {pendingFiles.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-surface-0 text-[9px] font-bold rounded-full flex items-center justify-center">
                      {pendingFiles.length}
                    </span>
                  )}
                </button>

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

const ACTION_LABELS: Record<string, string> = {
  trello_board: "📋 Trello — przegląd boardu",
  trello_boards: "📋 Trello — lista boardów",
  trello_list_cards: "📋 Trello — karty na liście",
  trello_get_card: "📋 Trello — szczegóły karty",
  trello_search: "🔍 Trello — wyszukiwanie",
  trello_comment: "💬 Trello — komentarz",
  trello_archive: "🗄️ Trello — archiwizacja",
  gmail_search: "📧 Gmail — wyszukiwanie",
  gmail_thread: "📧 Gmail — wątek",
  gmail_trash: "🗑️ Gmail — kosz",
  gmail_mark_read: "📧 Gmail — oznacz przeczytane",
  gmail_star: "⭐ Gmail — gwiazdka",
  gmail_labels: "🏷️ Gmail — etykiety",
  trello_create_card: "📋 Trello — nowa karta",
  trello_move_card: "📋 Trello — przeniesienie karty",
  gmail_send: "📧 Gmail — wysłanie emaila",
  gmail_draft: "📧 Gmail — draft emaila",
  calendar_create: "📅 Kalendarz — nowe wydarzenie",
  calendar_list: "📅 Kalendarz — lista wydarzeń",
  reminder: "⏰ Przypomnienie",
  note: "📝 Notatka",
  web_search: "🔍 Wyszukiwanie w internecie",
};

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
    return <ActionBubble text={entry.text} type={entry.type} />;
  }

  const usedActions =
    entry.actions?.filter(
      (a) => a.status === "success" || a.status === "error",
    ) ?? [];

  return (
    <div
      className={`animate-slide-up flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-accent/15 text-gray-100 rounded-br-md"
            : "bg-surface-2 text-gray-200 rounded-bl-md border border-surface-3"
        }`}
      >
        {entry.didResearch && !isUser && (
          <div className="text-[10px] text-purple-400 font-medium mb-1">
            🔍 Odpowiedź z researchu
          </div>
        )}

        {/* Thinking - collapsible */}
        {entry.thinking && !isUser && <ThinkingBlock text={entry.thinking} />}

        <div className="text-sm leading-relaxed">
          {/* Attached files */}
          {entry.attachedFiles && entry.attachedFiles.length > 0 && (
            <div className="space-y-2 mb-2">
              {/* Image previews */}
              {entry.attachedFiles.some((f) =>
                f.mimeType.startsWith("image/"),
              ) && (
                <div className="flex flex-wrap gap-2">
                  {entry.attachedFiles
                    .filter((f) => f.mimeType.startsWith("image/"))
                    .map((f, i) => (
                      <button
                        key={`img-${i}`}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const { getDownloadUrl } =
                              await import("../lib/api");
                            const url = await getDownloadUrl(f.s3Key);
                            window.open(url, "_blank");
                          } catch {
                            alert("Plik niedostępny");
                          }
                        }}
                        className="relative group rounded-lg overflow-hidden border border-surface-4 hover:border-accent/40 transition-colors"
                        title={`${f.filename} — kliknij aby otworzyć`}
                      >
                        {f.previewUrl ? (
                          <img
                            src={f.previewUrl}
                            alt={f.filename}
                            className="w-32 h-32 object-cover"
                          />
                        ) : (
                          <div className="w-32 h-32 bg-surface-3 flex items-center justify-center text-2xl">
                            🖼️
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 text-white text-lg transition-opacity">
                            ↗
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 text-[9px] text-gray-300 truncate">
                          {f.filename}
                        </div>
                      </button>
                    ))}
                </div>
              )}
              {/* Non-image files */}
              <div className="flex flex-wrap gap-1.5">
                {entry.attachedFiles
                  .filter((f) => !f.mimeType.startsWith("image/"))
                  .map((f, i) => (
                    <button
                      key={`doc-${i}`}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const { getDownloadUrl } = await import("../lib/api");
                          const url = await getDownloadUrl(f.s3Key);
                          window.open(url, "_blank");
                        } catch {
                          alert("Plik niedostępny");
                        }
                      }}
                      className="flex items-center gap-1.5 bg-surface-3/50 hover:bg-surface-3 rounded-lg px-2 py-1 text-[11px] transition-colors group cursor-pointer"
                      title={`Kliknij aby pobrać: ${f.filename}`}
                    >
                      <span>
                        {f.mimeType.includes("pdf")
                          ? "📄"
                          : f.mimeType.includes("word") ||
                              f.mimeType.includes("document")
                            ? "📝"
                            : "📎"}
                      </span>
                      <span className="text-gray-300 max-w-[140px] truncate group-hover:text-white">
                        {f.filename}
                      </span>
                      <span className="text-gray-600">
                        {(f.size / 1024).toFixed(0)}KB
                      </span>
                      <span
                        className={`text-[9px] px-1 rounded ${f.processingMethod === "scraper" ? "bg-blue-500/20 text-blue-400" : "bg-gray-500/20 text-gray-400"}`}
                      >
                        {f.processingMethod === "scraper" ? "📄" : "📃"}
                      </span>
                      <span className="text-gray-600 group-hover:text-accent text-[10px]">
                        ↗
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
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

        {/* Bottom bar */}
        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-600">
              {entry.time.toLocaleTimeString("pl-PL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {entry.stats && (
              <span className="text-[10px] font-mono text-gray-600">
                · ${entry.stats.costUsd.toFixed(5)}
              </span>
            )}
          </div>

          {/* Stats toggle — tylko dla wiadomości asystenta ze statystykami */}
          {!isUser && entry.stats && (
            <button
              onClick={() => setShowStats(!showStats)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 border ${
                showStats
                  ? "bg-surface-3 border-surface-4 text-gray-300"
                  : "bg-transparent border-surface-4 text-gray-600 hover:text-gray-400 hover:border-gray-500"
              }`}
            >
              <span>{showStats ? "▲" : "▼"}</span>
              Stats
            </button>
          )}
        </div>

        {/* Stats panel */}
        {showStats && entry.stats && (
          <div className="mt-2 pt-2 border-t border-surface-4 space-y-2">
            {/* Tokeny i koszt */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
              <div className="text-gray-500">Model</div>
              <div className="text-gray-300">{entry.stats.model}</div>

              <div className="text-gray-500">Tokeny wejście</div>
              <div className="text-gray-300">
                {entry.stats.inputTokens.toLocaleString()}
              </div>

              <div className="text-gray-500">Tokeny wyjście</div>
              <div className="text-gray-300">
                {entry.stats.outputTokens.toLocaleString()}
              </div>

              <div className="text-gray-500">Razem tokenów</div>
              <div className="text-gray-300">
                {entry.stats.totalTokens.toLocaleString()}
              </div>

              <div className="text-gray-500">Koszt</div>
              <div className="text-gray-300">
                ${entry.stats.costUsd.toFixed(6)}
              </div>

              <div className="text-gray-500">Czas odpowiedzi</div>
              <div className="text-gray-300">{entry.stats.latencyMs} ms</div>
            </div>

            {/* Użyte narzędzia/akcje */}
            {usedActions.length > 0 && (
              <div className="pt-1.5 border-t border-surface-4">
                <div className="text-[10px] text-gray-500 font-medium mb-1">
                  🛠 Użyte narzędzia
                </div>
                {usedActions.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[10px] py-0.5"
                  >
                    <span
                      className={
                        a.status === "success"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {a.status === "success" ? "✓" : "✗"}
                    </span>
                    <span className="text-gray-300">
                      {ACTION_LABELS[a.action] ?? a.action}
                    </span>
                    {a.status === "error" && a.error && (
                      <span className="text-red-400/70 truncate max-w-[160px]">
                        {a.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Research */}
            {entry.didResearch && (
              <div className="pt-1.5 border-t border-surface-4 text-[10px] text-purple-400">
                🔍 Odpowiedź wygenerowana z użyciem wyszukiwania
              </div>
            )}
          </div>
        )}
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

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-1.5 text-[10px] text-yellow-500/70 hover:text-yellow-400 transition-colors"
      >
        <span
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <span>💭 Tok rozumowania</span>
        {!open && (
          <span className="text-gray-600 truncate max-w-[200px]">
            — {text.slice(0, 60)}...
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1.5 pl-3 border-l-2 border-yellow-500/20 text-[11px] text-yellow-500/50 leading-relaxed animate-fade-in">
          {text}
        </div>
      )}
    </div>
  );
}

function ActionBubble({
  text,
  type,
}: {
  type: "action" | "error";
  text: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (type === "error") {
    return (
      <div className="animate-slide-up text-xs font-mono px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400">
        {text}
      </div>
    );
  }

  const match = text.match(/^✅ ([\w_]+): (.+)$/s);
  if (!match) {
    return (
      <div className="animate-slide-up text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
        {text}
      </div>
    );
  }

  const actionName = match[1];
  const label = ACTION_LABELS[actionName] ?? `⚙️ ${actionName}`;
  let parsed: any = null;
  try {
    parsed = JSON.parse(match[2]);
  } catch {}

  // Dedykowane renderowanie dla różnych typów akcji
  const renderDetails = () => {
    if (!parsed)
      return <div className="text-gray-400 font-mono">{match[2]}</div>;

    // Gmail — wysyłanie
    if (
      ["gmail_send", "gmail_draft", "gmail_reply", "gmail_forward"].includes(
        actionName,
      )
    ) {
      return (
        <div className="space-y-1.5">
          {parsed.to && <Row icon="→" label="Do" value={parsed.to} />}
          {parsed.subject && (
            <Row icon="📌" label="Temat" value={parsed.subject} />
          )}
          {parsed.body && <BodyPreview body={parsed.body} />}
          {parsed.messageId && (
            <Row icon="🆔" label="ID" value={parsed.messageId} mono />
          )}
        </div>
      );
    }
    {
      return (
        <div className="space-y-1.5">
          {parsed.to && <Row icon="→" label="Do" value={parsed.to} />}
          {parsed.subject && (
            <Row icon="📌" label="Temat" value={parsed.subject} />
          )}
          {parsed.body && (
            <div className="mt-2 pt-2 border-t border-emerald-500/15">
              <div className="text-gray-500 mb-1">✉️ Treść:</div>
              <div className="text-gray-300 whitespace-pre-wrap leading-relaxed bg-surface-3/30 rounded-lg px-2.5 py-2">
                {parsed.body}
              </div>
            </div>
          )}
          {parsed.messageId && (
            <Row icon="🆔" label="ID" value={parsed.messageId} mono />
          )}
        </div>
      );
    }
    {
      return (
        <div className="space-y-1.5">
          {parsed.to && <Row icon="→" label="Do" value={parsed.to} />}
          {parsed.subject && (
            <Row icon="📌" label="Temat" value={parsed.subject} />
          )}
          {parsed.messageId && (
            <Row icon="🆔" label="ID" value={parsed.messageId} mono />
          )}
          {parsed.threadId && parsed.threadId !== parsed.messageId && (
            <Row icon="🧵" label="Wątek" value={parsed.threadId} mono />
          )}
        </div>
      );
    }

    // Gmail — lista/profil
    if (actionName === "gmail_profile") {
      return (
        <div className="space-y-1.5">
          {parsed.email && <Row icon="📧" label="Konto" value={parsed.email} />}
          {parsed.messagesTotal != null && (
            <Row
              icon="📨"
              label="Wiadomości"
              value={parsed.messagesTotal.toLocaleString()}
            />
          )}
          {parsed.threadsTotal != null && (
            <Row
              icon="🧵"
              label="Wątki"
              value={parsed.threadsTotal.toLocaleString()}
            />
          )}
        </div>
      );
    }

    // Trello
    if (actionName === "trello_create_card") {
      return (
        <div className="space-y-1.5">
          {parsed.name && <Row icon="📋" label="Tytuł" value={parsed.name} />}
          {parsed.url && (
            <a
              href={parsed.url}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-accent hover:underline text-[10px]"
            >
              ↗ Otwórz kartę
            </a>
          )}
        </div>
      );
    }

    // Kalendarz
    if (actionName === "calendar_create") {
      return (
        <div className="space-y-1.5">
          {parsed.summary && (
            <Row icon="📅" label="Tytuł" value={parsed.summary} />
          )}
          {parsed.start?.dateTime && (
            <Row
              icon="🕐"
              label="Start"
              value={new Date(parsed.start.dateTime).toLocaleString("pl-PL")}
            />
          )}
          {parsed.htmlLink && (
            <a
              href={parsed.htmlLink}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 text-accent hover:underline text-[10px]"
            >
              ↗ Otwórz w kalendarzu
            </a>
          )}
        </div>
      );
    }

    // Fallback — generyczna siatka key/value
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {Object.entries(parsed).map(([k, v]) => (
          <div key={k} className="contents">
            <span className="text-gray-500 font-mono">{k}</span>
            <span className="text-gray-300 font-mono truncate">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="animate-slide-up bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-emerald-300 font-medium">{label}</span>
        </div>
        <span className="text-gray-600 text-[10px]">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-emerald-500/15">
          {renderDetails()}
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: string;
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0">{icon}</span>
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span
        className={`text-gray-200 truncate ${mono ? "font-mono text-[10px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function BodyPreview({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const preview = body.split("\n").find((l) => l.trim()) ?? body.slice(0, 60);
  const hasMore = body.trim().length > preview.length + 5;

  return (
    <div className="mt-1.5 pt-1.5 border-t border-emerald-500/15">
      <div className="text-gray-500 mb-1">✉️ Treść:</div>
      <div className="text-gray-300 bg-surface-3/30 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed">
        {open ? (
          <span className="whitespace-pre-wrap">{body}</span>
        ) : (
          <span className="text-gray-400 italic">
            {preview}
            {hasMore ? "…" : ""}
          </span>
        )}
        {hasMore && (
          <button
            onClick={() => setOpen(!open)}
            className="ml-2 text-accent hover:text-accent/80 text-[10px] font-medium"
          >
            {open ? "zwiń" : "pokaż więcej"}
          </button>
        )}
      </div>
    </div>
  );
}
