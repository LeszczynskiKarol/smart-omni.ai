import { useState, useEffect, useRef } from "react";

const TOKEN_RULES: Record<string, [RegExp, string][]> = {
  _common: [
    [/\/\/.*$/gm, "comment"],
    [/\/\*[\s\S]*?\*\//g, "comment"],
    [/#.*$/gm, "comment"],
    [/(["'`])(?:(?!\1|\\).|\\.)*\1/g, "string"],
    [/\b(\d+\.?\d*)\b/g, "number"],
  ],
  javascript: [
    [
      /\b(const|let|var|function|return|if|else|for|while|class|export|import|from|default|async|await|try|catch|throw|new|this|typeof|instanceof|switch|case|break|continue|do|in|of|yield)\b/g,
      "keyword",
    ],
    [/\b(true|false|null|undefined|NaN|Infinity)\b/g, "builtin"],
    [
      /\b(console|document|window|Math|Array|Object|String|Number|Promise|JSON|Date|Map|Set|RegExp|Error)\b/g,
      "builtin",
    ],
    [/(?<=\b)([\w$]+)(?=\s*\()/g, "function"],
    [/=>/g, "keyword"],
  ],
  typescript: [],
  python: [
    [
      /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|global|nonlocal|async|await)\b/g,
      "keyword",
    ],
    [
      /\b(True|False|None|self|cls|print|len|range|type|int|str|float|list|dict|set|tuple|super|isinstance|enumerate|zip|map|filter)\b/g,
      "builtin",
    ],
    [/(?<=\b)([\w]+)(?=\s*\()/g, "function"],
    [/"""[\s\S]*?"""|'''[\s\S]*?'''/g, "string"],
    [/f(["'])(?:(?!\1|\\).|\\.)*\1/g, "string"],
  ],
  bash: [
    [
      /\b(if|then|else|elif|fi|for|do|done|while|case|esac|function|return|exit|echo|cd|ls|rm|mv|cp|mkdir|chmod|chown|grep|sed|awk|cat|curl|wget|sudo|apt|npm|npx|git|docker|pm2|node|python)\b/g,
      "keyword",
    ],
    [/\$\{?[\w]+\}?/g, "builtin"],
    [/--?[\w-]+/g, "flag"],
  ],
  sql: [
    [
      /\b(SELECT|FROM|WHERE|INSERT|INTO|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|EXISTS|BETWEEN|LIKE|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|VALUES|CONSTRAINT|CASCADE|IF|BEGIN|COMMIT|ROLLBACK)\b/gi,
      "keyword",
    ],
    [
      /\b(INT|INTEGER|VARCHAR|TEXT|BOOLEAN|FLOAT|DOUBLE|DECIMAL|DATE|DATETIME|TIMESTAMP|BIGINT|SERIAL|UUID|JSON|JSONB|ARRAY)\b/gi,
      "builtin",
    ],
  ],
  css: [
    [
      /\b(color|background|border|margin|padding|display|flex|grid|position|width|height|font|text|align|justify|gap|overflow|opacity|transform|transition|animation|z-index|box-shadow|border-radius)\b/g,
      "keyword",
    ],
    [/#[0-9a-fA-F]{3,8}\b/g, "number"],
    [/\b\d+\.?\d*(px|em|rem|%|vh|vw|deg|s|ms)\b/g, "number"],
    [/\.[\w-]+/g, "function"],
    [/@[\w-]+/g, "builtin"],
  ],
  html: [
    [/<\/?[\w-]+/g, "keyword"],
    [/\/?>/g, "keyword"],
    [
      /\b(class|id|href|src|alt|style|type|name|value|placeholder|disabled|onclick|onchange)(?==)/g,
      "builtin",
    ],
  ],
  json: [
    [/"(?:[^"\\]|\\.)*"\s*:/g, "keyword"],
    [/"(?:[^"\\]|\\.)*"/g, "string"],
    [/\b(true|false|null)\b/g, "builtin"],
  ],
  yaml: [
    [/^[\w-]+(?=:)/gm, "keyword"],
    [/:\s/g, "keyword"],
    [/\b(true|false|null|yes|no)\b/gi, "builtin"],
  ],
  nginx: [
    [
      /\b(server|location|listen|server_name|root|index|proxy_pass|proxy_set_header|ssl_certificate|ssl_certificate_key|return|rewrite|gzip|add_header|expires|try_files|include|upstream|error_page|access_log|error_log)\b/g,
      "keyword",
    ],
    [/\b(on|off)\b/g, "builtin"],
  ],
  prisma: [
    [/\b(model|datasource|generator|enum)\b/g, "keyword"],
    [/\b(String|Int|Float|Boolean|DateTime|Json|BigInt)\b/g, "builtin"],
    [/@[\w.]+/g, "function"],
  ],
};

TOKEN_RULES.typescript = [...TOKEN_RULES.javascript];
TOKEN_RULES.ts = TOKEN_RULES.typescript;
TOKEN_RULES.js = TOKEN_RULES.javascript;
TOKEN_RULES.jsx = TOKEN_RULES.javascript;
TOKEN_RULES.tsx = TOKEN_RULES.typescript;
TOKEN_RULES.py = TOKEN_RULES.python;
TOKEN_RULES.sh = TOKEN_RULES.bash;
TOKEN_RULES.shell = TOKEN_RULES.bash;
TOKEN_RULES.zsh = TOKEN_RULES.bash;
TOKEN_RULES.conf = TOKEN_RULES.nginx;
TOKEN_RULES.yml = TOKEN_RULES.yaml;
TOKEN_RULES.env = TOKEN_RULES.bash;
TOKEN_RULES.dotenv = TOKEN_RULES.bash;
TOKEN_RULES.jsonc = TOKEN_RULES.json;
TOKEN_RULES.scss = TOKEN_RULES.css;
TOKEN_RULES.less = TOKEN_RULES.css;
TOKEN_RULES.graphql = TOKEN_RULES.sql;
TOKEN_RULES.gql = TOKEN_RULES.sql;

function highlightCode(code: string, language: string): string {
  const lang = language.toLowerCase();
  const rules = [...(TOKEN_RULES._common || []), ...(TOKEN_RULES[lang] || [])];
  if (rules.length <= TOKEN_RULES._common.length && !TOKEN_RULES[lang]) {
    return escapeHtml(code);
  }
  interface Token {
    start: number;
    end: number;
    cls: string;
  }
  const tokens: Token[] = [];
  for (const [regex, cls] of rules) {
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(code)) !== null) {
      tokens.push({
        start: match.index,
        end: match.index + match[0].length,
        cls,
      });
      if (!re.global) break;
    }
  }
  tokens.sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );
  const filtered: Token[] = [];
  let lastEnd = 0;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      filtered.push(t);
      lastEnd = t.end;
    }
  }
  let result = "";
  let pos = 0;
  for (const t of filtered) {
    if (t.start > pos) result += escapeHtml(code.slice(pos, t.start));
    result += `<span class="tok-${t.cls}">${escapeHtml(code.slice(t.start, t.end))}</span>`;
    pos = t.end;
  }
  if (pos < code.length) result += escapeHtml(code.slice(pos));
  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const LANG_HINTS: [RegExp, string][] = [
  [/\b(import|export|const|let|var|=>|async|await)\b/, "javascript"],
  [/\b(def|elif|self|__init__|import\s+\w+)\b/, "python"],
  [/^\s*(SELECT|INSERT|CREATE|ALTER|DROP)\b/im, "sql"],
  [/^\s*<(!DOCTYPE|html|div|span|body|head)\b/im, "html"],
  [/^\s*\{[\s\n]*"/, "json"],
  [/^\s*(server|location|upstream)\s*\{/m, "nginx"],
  [/^\s*(model|datasource|generator)\s+\w+/m, "prisma"],
  [/^\s*(FROM|RUN|CMD|COPY|EXPOSE|WORKDIR)\b/m, "dockerfile"],
  [/^\s*[\w-]+:\s/m, "yaml"],
  [/^\s*(#!\/bin\/(bash|sh)|apt|npm|git|curl|sudo)\b/m, "bash"],
  [/\.(tsx?|jsx?)$/, "typescript"],
  [/\.py$/, "python"],
  [/\.css$/, "css"],
];

function detectLanguage(code: string, hint?: string): string {
  if (hint && hint !== "text" && hint !== "plaintext")
    return hint.toLowerCase();
  for (const [re, lang] of LANG_HINTS) {
    if (re.test(code)) return lang;
  }
  return "text";
}

const LANG_NAMES: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  bash: "Bash",
  sh: "Shell",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  yaml: "YAML",
  nginx: "Nginx",
  prisma: "Prisma",
  jsx: "JSX",
  tsx: "TSX",
  dockerfile: "Dockerfile",
  graphql: "GraphQL",
  env: ".env",
  conf: "Config",
  markdown: "Markdown",
  md: "Markdown",
  text: "Text",
  plaintext: "Text",
  xml: "XML",
  yml: "YAML",
};

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export default function CodeBlock({
  code,
  language,
  filename,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const lang = detectLanguage(code, language);
  const displayName = LANG_NAMES[lang] || lang;
  const lines = code.split("\n");
  const lineCount = lines.length;
  const isLong = lineCount > 25;

  useEffect(() => {
    if (isLong) setCollapsed(true);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibleLines = collapsed ? lines.slice(0, 12) : lines;

  return (
    <div className="code-block my-3 rounded-xl border border-surface-4/50 bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/80 border-b border-surface-4/30 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-[11px] font-mono text-gray-500">
            {filename || displayName}
          </span>
          {filename && (
            <span className="text-[9px] font-mono text-gray-600 bg-surface-3 px-1.5 py-0.5 rounded">
              {displayName}
            </span>
          )}
          <span className="text-[9px] text-gray-600">{lineCount} lines</span>
        </div>
        <div className="flex items-center gap-1">
          {isLong && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded hover:bg-surface-3 transition-colors"
            >
              {collapsed ? `▼ Pokaż wszystko (${lineCount})` : "▲ Zwiń"}
            </button>
          )}
        </div>
      </div>

      {/* Wrapper bez overflow — sticky działa tylko tutaj */}
      <div className="relative">
        {/* Sticky copy button — przyklejony do góry viewportu w ramach bloku */}
        <div className="sticky top-0 z-20 flex justify-end pr-2 -mb-7 pointer-events-none">
          <button
            onClick={handleCopy}
            className={`pointer-events-auto text-[10px] px-2 py-0.5 rounded transition-all duration-200 ${
              copied
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-surface-1/90 border border-surface-4 text-gray-500 hover:text-gray-300 hover:border-gray-500"
            }`}
          >
            {copied ? "✓ Skopiowano" : "Kopiuj"}
          </button>
        </div>

        {/* Kod — overflow-x osobno, nie blokuje sticky */}
        <div
          className={`overflow-x-auto relative ${collapsed ? "max-h-[320px]" : ""}`}
        >
          <pre
            ref={codeRef}
            className="p-3 text-[13px] leading-[1.6] font-mono m-0 bg-transparent"
          >
            <code>
              {visibleLines.map((line, i) => (
                <div key={i} className="code-line flex">
                  <span className="code-line-num select-none text-right pr-4 text-gray-600/40 w-[3ch] shrink-0 text-[11px]">
                    {i + 1}
                  </span>
                  <span
                    className="code-line-content flex-1 whitespace-pre"
                    dangerouslySetInnerHTML={{
                      __html: highlightCode(line, lang),
                    }}
                  />
                </div>
              ))}
            </code>
          </pre>
          {collapsed && isLong && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0e14] to-transparent pointer-events-none" />
          )}
        </div>
      </div>

      {collapsed && isLong && (
        <button
          onClick={() => setCollapsed(false)}
          className="w-full py-1.5 text-[11px] text-gray-500 hover:text-accent bg-surface-2/50 hover:bg-surface-2 border-t border-surface-4/30 transition-colors rounded-b-xl"
        >
          ▼ Pokaż cały kod ({lineCount} linii)
        </button>
      )}
    </div>
  );
}

export function InlineCode({ children }: { children: string }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-surface-3/80 text-accent/90 text-[13px] font-mono border border-surface-4/30">
      {children}
    </code>
  );
}

export { detectLanguage, highlightCode, escapeHtml };
