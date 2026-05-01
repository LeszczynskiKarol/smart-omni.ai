// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ActionBubble — rich renderers for tool results
// src/components/ActionBubble.tsx
// Replace the existing ActionBubble, Row, BodyPreview in App.tsx
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, type ReactNode } from "react";

// ── Label mapping (keep existing, add missing) ──

export const ACTION_LABELS: Record<string, string> = {
  trello_board: "📋 Trello — przegląd boardu",
  trello_boards: "📋 Trello — lista boardów",
  trello_list_cards: "📋 Trello — karty na liście",
  trello_get_card: "📋 Trello — szczegóły karty",
  trello_search: "🔍 Trello — wyszukiwanie",
  trello_comment: "💬 Trello — komentarz",
  trello_archive: "🗄️ Trello — archiwizacja",
  trello_create_card: "📋 Trello — nowa karta",
  trello_create_board: "📋 Trello — nowy board",
  trello_create_list: "📋 Trello — nowa lista",
  trello_move_card: "📋 Trello — przeniesienie karty",
  trello_update_card: "📋 Trello — aktualizacja karty",
  trello_delete: "🗑️ Trello — usunięcie karty",
  trello_checklist: "☑️ Trello — checklista",
  trello_toggle_check: "☑️ Trello — odznaczenie",
  trello_activity: "📊 Trello — aktywność",
  gmail_search: "📧 Gmail — wyszukiwanie",
  gmail_thread: "📧 Gmail — wątek",
  gmail_trash: "🗑️ Gmail — kosz",
  gmail_untrash: "📧 Gmail — przywrócenie",
  gmail_mark_read: "📧 Gmail — oznacz przeczytane",
  gmail_star: "⭐ Gmail — gwiazdka",
  gmail_labels: "🏷️ Gmail — etykiety",
  gmail_modify_labels: "🏷️ Gmail — zmiana etykiet",
  gmail_batch_modify: "📧 Gmail — operacja zbiorcza",
  gmail_send: "📧 Gmail — wysłanie emaila",
  gmail_draft: "📧 Gmail — draft emaila",
  gmail_reply: "📧 Gmail — odpowiedź",
  gmail_forward: "📧 Gmail — przekazanie",
  gmail_list: "📧 Gmail — lista emaili",
  gmail_read: "📧 Gmail — odczyt emaila",
  gmail_profile: "📧 Gmail — profil konta",
  calendar_create: "📅 Kalendarz — nowe wydarzenie",
  calendar_list: "📅 Kalendarz — lista wydarzeń",
  reminder: "⏰ Przypomnienie",
  note: "📝 Notatka",
  web_search: "🔍 Wyszukiwanie w internecie",
};

// ── Icon for Trello label colors ──

const TRELLO_LABEL_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  sky: "bg-sky-400",
  lime: "bg-lime-500",
  pink: "bg-pink-500",
  black: "bg-gray-700",
};

// ── Helper components ──

function Pill({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function LinkOut({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1.5 text-accent hover:text-accent/80 text-[11px] font-medium transition-colors group"
    >
      <span className="group-hover:underline">{children}</span>
      <span className="opacity-60 group-hover:opacity-100 transition-opacity text-[10px]">
        ↗
      </span>
    </a>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="shrink-0 w-4 text-center">{icon}</span>
      <span className="text-gray-500 shrink-0 min-w-[4rem]">{label}</span>
      <div className="text-gray-200 min-w-0 break-words flex-1">{children}</div>
    </div>
  );
}

function UpdatedFieldsPills({ fields }: { fields: string[] }) {
  const fieldLabels: Record<string, string> = {
    desc: "opis",
    name: "nazwa",
    due: "deadline",
    dueComplete: "deadline status",
    closed: "status",
    idList: "lista",
  };
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {fields.map((f) => (
        <Pill
          key={f}
          className="bg-blue-500/15 text-blue-400 border border-blue-500/20"
        >
          ✎ {fieldLabels[f] || f}
        </Pill>
      ))}
    </div>
  );
}

function TrelloCardMini({
  name,
  url,
  id,
}: {
  name: string;
  url?: string;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-surface-3/40 rounded-lg px-3 py-2 border border-surface-4">
      <span className="text-base">📝</span>
      <div className="min-w-0 flex-1">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="text-[12px] font-medium text-gray-100 hover:text-accent transition-colors"
          >
            {name}
          </a>
        ) : (
          <span className="text-[12px] font-medium text-gray-100">{name}</span>
        )}
        {id && (
          <div className="text-[9px] font-mono text-gray-600 mt-0.5">{id}</div>
        )}
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="shrink-0 w-7 h-7 rounded-md bg-accent/10 hover:bg-accent/20 flex items-center justify-center text-accent text-xs transition-colors"
        >
          ↗
        </a>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dedicated renderers per action type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderTrelloUpdateCard(data: any) {
  return (
    <div className="space-y-2">
      <TrelloCardMini name={data.name} url={data.url} id={data.cardId} />
      {data.updated && <UpdatedFieldsPills fields={data.updated} />}
      {data.description !== undefined && (
        <div className="text-[11px] text-gray-400 bg-surface-3/30 rounded-lg px-2.5 py-2 border-l-2 border-blue-500/30">
          <span className="text-gray-500 text-[9px] uppercase tracking-wider font-semibold block mb-1">
            Nowy opis
          </span>
          <span className="text-gray-300">
            {data.description?.slice(0, 300)}
            {data.description?.length > 300 ? "…" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function renderTrelloCreateCard(data: any) {
  return (
    <div className="space-y-2">
      <TrelloCardMini name={data.name} url={data.url} id={data.cardId} />
      {data.listId && (
        <DetailRow icon="📋" label="Lista">
          <span className="font-mono text-[10px] text-gray-400">
            {data.listId}
          </span>
        </DetailRow>
      )}
    </div>
  );
}

function renderTrelloMoveCard(data: any) {
  return (
    <div className="space-y-2">
      <TrelloCardMini name={data.cardName} id={data.cardId} />
      <div className="flex items-center gap-2 text-[11px]">
        <Pill className="bg-gray-500/15 text-gray-400 border border-gray-500/20">
          📋 przeniesiono
        </Pill>
        <span className="text-gray-600">→</span>
        <Pill className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          {data.movedTo}
        </Pill>
      </div>
    </div>
  );
}

function renderTrelloComment(data: any) {
  return (
    <div className="space-y-2">
      {data.cardId && (
        <DetailRow icon="📝" label="Karta">
          <span className="font-mono text-[10px]">{data.cardId}</span>
        </DetailRow>
      )}
      <div className="text-[11px] text-gray-300 bg-surface-3/30 rounded-lg px-2.5 py-2 border-l-2 border-yellow-500/30">
        <span className="text-gray-500 text-[9px] uppercase tracking-wider font-semibold block mb-1">
          Komentarz
        </span>
        {data.text}
      </div>
    </div>
  );
}

function renderTrelloArchive(data: any) {
  return (
    <div className="flex items-center gap-2">
      <Pill className="bg-gray-500/15 text-gray-400 border border-gray-500/20">
        🗄️ Zarchiwizowano
      </Pill>
      <span className="text-[10px] font-mono text-gray-500">{data.cardId}</span>
    </div>
  );
}

function renderTrelloDelete(data: any) {
  return (
    <div className="flex items-center gap-2">
      <Pill className="bg-red-500/15 text-red-400 border border-red-500/20">
        🗑️ Usunięto na stałe
      </Pill>
      <span className="text-[10px] font-mono text-gray-500">{data.cardId}</span>
    </div>
  );
}

function renderTrelloChecklist(data: any) {
  return (
    <div className="space-y-2">
      <DetailRow icon="☑️" label="Checklista">
        <span className="font-medium text-gray-100">{data.name}</span>
      </DetailRow>
      {data.cardId && (
        <DetailRow icon="📝" label="Karta">
          <span className="font-mono text-[10px]">{data.cardId}</span>
        </DetailRow>
      )}
      {data.items?.length > 0 && (
        <div className="pl-6 space-y-0.5">
          {data.items.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span
                className={
                  item.state === "complete"
                    ? "text-emerald-400"
                    : "text-gray-600"
                }
              >
                {item.state === "complete" ? "☑" : "☐"}
              </span>
              <span className="text-gray-300">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderTrelloToggleCheck(data: any) {
  return (
    <div className="flex items-center gap-2">
      <Pill
        className={`border ${data.state === "complete" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-gray-500/15 text-gray-400 border-gray-500/20"}`}
      >
        {data.state === "complete" ? "☑ Zrobione" : "☐ Cofnięto"}
      </Pill>
      <span className="text-[10px] font-mono text-gray-500">
        {data.checkItemId}
      </span>
    </div>
  );
}

function renderTrelloCreateBoard(data: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-surface-3/40 rounded-lg px-3 py-2 border border-surface-4">
        <span className="text-base">📋</span>
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-medium text-gray-100">
            {data.name}
          </span>
          {data.boardId && (
            <div className="text-[9px] font-mono text-gray-600 mt-0.5">
              {data.boardId}
            </div>
          )}
        </div>
        {data.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener"
            className="shrink-0 w-7 h-7 rounded-md bg-accent/10 hover:bg-accent/20 flex items-center justify-center text-accent text-xs transition-colors"
          >
            ↗
          </a>
        )}
      </div>
      {data.lists?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.lists.map((l: any) => (
            <Pill
              key={l.id}
              className="bg-surface-3 text-gray-300 border border-surface-4"
            >
              📋 {l.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

function renderTrelloCreateList(data: any) {
  return (
    <div className="space-y-1.5">
      <DetailRow icon="📋" label="Lista">
        <span className="font-medium text-gray-100">{data.name}</span>
      </DetailRow>
      {data.boardId && (
        <DetailRow icon="🗂️" label="Board">
          <span className="font-mono text-[10px]">{data.boardId}</span>
        </DetailRow>
      )}
    </div>
  );
}

function renderTrelloBoard(data: any) {
  const board = data.board;
  const lists: any[] = data.lists || [];
  const totalCards = lists.reduce(
    (sum: number, l: any) => sum + (l.cards?.length || 0),
    0,
  );

  return (
    <div className="space-y-2">
      {board?.name && (
        <div className="flex items-center gap-2 bg-surface-3/40 rounded-lg px-3 py-2 border border-surface-4">
          <span className="text-base">📋</span>
          <div className="min-w-0 flex-1">
            <span className="text-[12px] font-medium text-gray-100">
              {board.name}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-gray-500">
                {lists.length} list · {totalCards} kart
              </span>
              {board.lastActivity && (
                <span className="text-[9px] text-gray-600">
                  akt.{" "}
                  {new Date(board.lastActivity).toLocaleDateString("pl-PL")}
                </span>
              )}
            </div>
          </div>
          {board.url && (
            <a
              href={board.url}
              target="_blank"
              rel="noopener"
              className="shrink-0 w-7 h-7 rounded-md bg-accent/10 hover:bg-accent/20 flex items-center justify-center text-accent text-xs transition-colors"
            >
              ↗
            </a>
          )}
        </div>
      )}
      {lists.length > 0 && (
        <div className="space-y-2 mt-1">
          {lists.map((list: any) => (
            <div key={list.id} className="border-l-2 border-surface-4 pl-2.5">
              <div className="flex items-center gap-2 text-[11px] mb-1">
                <span className="text-gray-300 font-medium">{list.name}</span>
                <span className="text-gray-600 text-[9px]">
                  ({list.cards?.length || 0})
                </span>
              </div>
              {list.cards?.slice(0, 8).map((card: any) => (
                <div
                  key={card.id}
                  className="flex items-center gap-1.5 py-0.5 pl-1"
                >
                  <span className="text-[9px] text-gray-600">├─</span>
                  <a
                    href={card.url}
                    target="_blank"
                    rel="noopener"
                    className="text-[11px] text-gray-300 hover:text-accent transition-colors truncate"
                  >
                    {card.name}
                  </a>
                  {card.labels?.map((l: any, i: number) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full shrink-0 ${TRELLO_LABEL_COLORS[l.color] || "bg-gray-500"}`}
                      title={l.name || l.color}
                    />
                  ))}
                  {card.due && (
                    <span className="text-[9px] text-yellow-500/70 shrink-0">
                      📅 {new Date(card.due).toLocaleDateString("pl-PL")}
                    </span>
                  )}
                </div>
              ))}
              {(list.cards?.length || 0) > 8 && (
                <div className="text-[9px] text-gray-600 pl-5">
                  +{list.cards.length - 8} więcej…
                </div>
              )}
              {(!list.cards || list.cards.length === 0) && (
                <div className="text-[9px] text-gray-600 italic pl-5">
                  pusta
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderTrelloSearch(data: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Pill className="bg-blue-500/15 text-blue-400 border border-blue-500/20">
          🔍 „{data.query}"
        </Pill>
        <span className="text-[10px] text-gray-500">
          {data.totalFound} wyników
        </span>
      </div>
      {data.cards?.slice(0, 6).map((card: any) => (
        <div
          key={card.id}
          className="flex items-start gap-2 bg-surface-3/30 rounded-lg px-2.5 py-1.5"
        >
          <span className="text-sm shrink-0 mt-0.5">📝</span>
          <div className="min-w-0 flex-1">
            <a
              href={card.url}
              target="_blank"
              rel="noopener"
              className="text-[11px] font-medium text-gray-200 hover:text-accent transition-colors"
            >
              {card.name}
            </a>
            {card.listName && (
              <span className="text-[9px] text-gray-500 ml-2">
                na: {card.listName}
              </span>
            )}
            {card.description && (
              <div className="text-[10px] text-gray-500 truncate mt-0.5">
                {card.description.slice(0, 100)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderTrelloGetCard(data: any) {
  return (
    <div className="space-y-2">
      <TrelloCardMini name={data.name} url={data.url} id={data.id} />
      {data.listName && (
        <DetailRow icon="📋" label="Lista">
          <span>{data.listName}</span>
        </DetailRow>
      )}
      {data.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.labels.map((l: any, i: number) => (
            <Pill
              key={i}
              className={`text-white/90 ${TRELLO_LABEL_COLORS[l.color] || "bg-gray-600"}`}
            >
              {l.name || l.color}
            </Pill>
          ))}
        </div>
      )}
      {data.due && (
        <DetailRow icon="📅" label="Deadline">
          <span
            className={
              data.dueComplete
                ? "text-emerald-400 line-through"
                : "text-yellow-400"
            }
          >
            {new Date(data.due).toLocaleString("pl-PL")}
            {data.dueComplete && " ✓"}
          </span>
        </DetailRow>
      )}
      {data.description && (
        <div className="text-[11px] text-gray-300 bg-surface-3/30 rounded-lg px-2.5 py-2">
          {data.description.slice(0, 400)}
          {data.description.length > 400 ? "…" : ""}
        </div>
      )}
      {data.members?.length > 0 && (
        <DetailRow icon="👤" label="Przypisani">
          {data.members.join(", ")}
        </DetailRow>
      )}
      {data.checklists?.length > 0 && (
        <div className="space-y-1.5">
          {data.checklists.map((cl: any, ci: number) => {
            const done =
              cl.items?.filter((i: any) => i.state === "complete").length || 0;
            const total = cl.items?.length || 0;
            return (
              <div key={ci}>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-gray-400 font-medium">
                    ☑️ {cl.name}
                  </span>
                  <span className="text-[9px] text-gray-500">
                    {done}/{total}
                  </span>
                  <div className="flex-1 h-1 bg-surface-4 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500/60 rounded-full transition-all"
                      style={{
                        width: `${total > 0 ? (done / total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data.comments?.length > 0 && (
        <div className="space-y-1 mt-1 pt-1 border-t border-surface-4">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
            Komentarze
          </span>
          {data.comments.slice(0, 3).map((c: any, i: number) => (
            <div key={i} className="text-[10px] pl-2 border-l border-surface-4">
              <span className="text-gray-400 font-medium">{c.author}</span>
              <span className="text-gray-600 ml-1">
                {new Date(c.date).toLocaleDateString("pl-PL")}
              </span>
              <div className="text-gray-400 mt-0.5">{c.text.slice(0, 150)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderTrelloActivity(data: any) {
  const typeLabels: Record<string, string> = {
    createCard: "✚ Nowa karta",
    updateCard: "✎ Aktualizacja",
    moveCardToBoard: "→ Przeniesienie",
    addMemberToCard: "👤 Przypisanie",
    commentCard: "💬 Komentarz",
    deleteCard: "🗑️ Usunięcie",
    addChecklistToCard: "☑ Checklista",
    updateCheckItemStateOnCard: "☑ Odznaczenie",
    addAttachmentToCard: "📎 Załącznik",
  };

  return (
    <div className="space-y-1">
      <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
        Ostatnia aktywność ({data.total})
      </span>
      {data.activities?.slice(0, 10).map((a: any, i: number) => (
        <div key={i} className="flex items-start gap-2 py-0.5 text-[10px]">
          <span className="text-gray-600 shrink-0 w-16 text-right">
            {new Date(a.date).toLocaleDateString("pl-PL", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
          <span className="text-gray-400 shrink-0">
            {typeLabels[a.type] || a.type}
          </span>
          {a.card && <span className="text-gray-300 truncate">{a.card}</span>}
          {a.list && <span className="text-gray-500">→ {a.list}</span>}
        </div>
      ))}
    </div>
  );
}

function renderTrelloBoards(data: any) {
  return (
    <div className="space-y-1.5">
      {data.boards?.map((b: any) => (
        <div
          key={b.id}
          className="flex items-center gap-2 bg-surface-3/30 rounded-lg px-2.5 py-1.5"
        >
          <span className="text-sm">📋</span>
          <div className="min-w-0 flex-1">
            <a
              href={b.url}
              target="_blank"
              rel="noopener"
              className="text-[11px] font-medium text-gray-200 hover:text-accent transition-colors"
            >
              {b.name}
            </a>
            {b.lastActivity && (
              <span className="text-[9px] text-gray-500 ml-2">
                akt. {new Date(b.lastActivity).toLocaleDateString("pl-PL")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderTrelloListCards(data: any) {
  return (
    <div className="space-y-1.5">
      {data.list && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] text-gray-300 font-medium">
            📋 {data.list.name}
          </span>
          <span className="text-[9px] text-gray-500">
            {data.totalCards} kart
          </span>
        </div>
      )}
      {data.cards?.slice(0, 10).map((card: any) => (
        <div key={card.id} className="flex items-center gap-1.5 py-0.5">
          <span className="text-[9px] text-gray-600">•</span>
          <a
            href={card.url}
            target="_blank"
            rel="noopener"
            className="text-[11px] text-gray-300 hover:text-accent transition-colors truncate"
          >
            {card.name}
          </a>
          {card.labels?.map((l: any, i: number) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full shrink-0 ${TRELLO_LABEL_COLORS[l.color] || "bg-gray-500"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Gmail renderers ──

function renderGmailSend(data: any) {
  return (
    <div className="space-y-1.5">
      {data.to && (
        <DetailRow icon="→" label="Do">
          {data.to}
        </DetailRow>
      )}
      {data.subject && (
        <DetailRow icon="📌" label="Temat">
          {data.subject}
        </DetailRow>
      )}
      {data.body && <BodyPreview body={data.body} />}
      {data.messageId && (
        <DetailRow icon="🆔" label="ID">
          <span className="font-mono text-[10px] text-gray-400">
            {data.messageId}
          </span>
        </DetailRow>
      )}
    </div>
  );
}

function renderGmailProfile(data: any) {
  return (
    <div className="space-y-1.5">
      {data.email && (
        <DetailRow icon="📧" label="Konto">
          {data.email}
        </DetailRow>
      )}
      {data.messagesTotal != null && (
        <DetailRow icon="📨" label="Wiadomości">
          {data.messagesTotal.toLocaleString()}
        </DetailRow>
      )}
      {data.threadsTotal != null && (
        <DetailRow icon="🧵" label="Wątki">
          {data.threadsTotal.toLocaleString()}
        </DetailRow>
      )}
    </div>
  );
}

function renderCalendarCreate(data: any) {
  return (
    <div className="space-y-1.5">
      {data.summary && (
        <DetailRow icon="📅" label="Tytuł">
          {data.summary}
        </DetailRow>
      )}
      {data.start?.dateTime && (
        <DetailRow icon="🕐" label="Start">
          {new Date(data.start.dateTime).toLocaleString("pl-PL")}
        </DetailRow>
      )}
      {data.htmlLink && (
        <LinkOut href={data.htmlLink}>Otwórz w kalendarzu</LinkOut>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Renderer dispatcher
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ACTION_RENDERERS: Record<string, (data: any) => ReactNode> = {
  // Trello
  trello_update_card: renderTrelloUpdateCard,
  trello_create_card: renderTrelloCreateCard,
  trello_move_card: renderTrelloMoveCard,
  trello_comment: renderTrelloComment,
  trello_archive: renderTrelloArchive,
  trello_delete: renderTrelloDelete,
  trello_checklist: renderTrelloChecklist,
  trello_toggle_check: renderTrelloToggleCheck,
  trello_create_board: renderTrelloCreateBoard,
  trello_create_list: renderTrelloCreateList,
  trello_board: renderTrelloBoard,
  trello_boards: renderTrelloBoards,
  trello_list_cards: renderTrelloListCards,
  trello_search: renderTrelloSearch,
  trello_get_card: renderTrelloGetCard,
  trello_activity: renderTrelloActivity,
  // Gmail
  gmail_send: renderGmailSend,
  gmail_draft: renderGmailSend,
  gmail_reply: renderGmailSend,
  gmail_forward: renderGmailSend,
  gmail_profile: renderGmailProfile,
  // Calendar
  calendar_create: renderCalendarCreate,
};

// Generic fallback for unknown actions
function renderGeneric(data: any) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[10px]">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-gray-500 font-mono">{k}</span>
          <span className="text-gray-300 truncate">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main ActionBubble component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function ActionBubble({
  text,
  type,
}: {
  type: "action" | "error";
  text: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (type === "error") {
    return (
      <div className="animate-slide-up flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/15">
        <span className="text-red-400 shrink-0 text-xs mt-px">✗</span>
        <span className="text-xs text-red-400/90 leading-relaxed">{text}</span>
      </div>
    );
  }

  const match = text.match(/^✅ ([\w_]+): (.+)$/s);
  if (!match) {
    return (
      <div className="animate-slide-up text-xs px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-emerald-400">
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

  const renderer = ACTION_RENDERERS[actionName];

  return (
    <div className="animate-slide-up bg-emerald-500/6 border border-emerald-500/15 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-emerald-500/5 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-emerald-400 text-xs font-bold shrink-0">✓</span>
          <span className="text-emerald-300/90 text-xs font-medium truncate">
            {label}
          </span>
        </div>
        <span
          className={`text-gray-600 text-[10px] transition-transform duration-200 shrink-0 ${expanded ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-emerald-500/10 text-[11px]">
          {parsed && renderer ? (
            renderer(parsed)
          ) : parsed ? (
            renderGeneric(parsed)
          ) : (
            <div className="text-gray-400 font-mono text-[10px] break-all">
              {match[2]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── BodyPreview (kept for Gmail) ──

function BodyPreview({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const preview = body.split("\n").find((l) => l.trim()) ?? body.slice(0, 60);
  const hasMore = body.trim().length > preview.length + 5;

  return (
    <div className="mt-1.5 pt-1.5 border-t border-emerald-500/10">
      <div className="text-gray-500 mb-1 text-[10px]">✉️ Treść:</div>
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

export default ActionBubble;
