"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * 예약 대화 (1.8.0) — 예약마다 대화방.
 * - member: 호스트·로그인 게스트(/api/v1/bookings/{id}/messages, 쿠키 세션)
 * - guest: 계정 없는 게스트(/api/guest-booking, 관리 링크 토큰)
 * 글자만. 상대 글은 신고할 수 있고, 호스트는 대화를 닫거나 다시 열 수 있다.
 */

type Msg = { id: string; role: "host" | "guest"; mine: boolean; body: string; createdAt: string };
type State = { canWrite: boolean; reason: string | null; closed: boolean; writeClosesAt: string };
type ChatData = {
  messages: Msg[];
  state: State;
  hostLabel?: string;
  guestLabel?: string;
  suggestFirstNote?: boolean;
  role?: "host" | "guest";
};

export type ChatSource = { kind: "member"; bookingId: string } | { kind: "guest"; token: string };

async function call(source: ChatSource, op: "load" | "send" | "report" | "close" | "reopen", payload: Record<string, unknown> = {}) {
  if (source.kind === "guest") {
    const action = op === "load" ? "messages" : op === "send" ? "send_message" : "report_message";
    const r = await fetch("/api/guest-booking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: source.token, action, ...payload }),
      cache: "no-store",
    });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  }
  const url = `/api/v1/bookings/${source.bookingId}/messages`;
  const init: RequestInit =
    op === "load"
      ? { cache: "no-store" }
      : op === "send"
        ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: payload.text }) }
        : { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: op, ...payload }) };
  const r = await fetch(url, init);
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BookingChat({ source, otherLabel, onRead }: { source: ChatSource; otherLabel?: string; onRead?: () => void }) {
  const [data, setData] = useState<ChatData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await call(source, "load");
    if (!r.ok) {
      setError(r.data?.error ?? "대화를 불러오지 못했어요.");
      return;
    }
    setError(null);
    setData(r.data as ChatData);
    onRead?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind === "guest" ? source.token : source.bookingId]);

  useEffect(() => {
    void load();
    // 열려 있는 동안 30초마다 새 글 확인
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [data?.messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const r = await call(source, "send", { text: body });
    setBusy(false);
    if (!r.ok) {
      setError(r.data?.error ?? "보내지 못했어요.");
      return;
    }
    setText("");
    await load();
  };

  const report = async (m: Msg) => {
    if (!window.confirm("이 메시지를 신고할까요? 운영팀이 확인해요.")) return;
    const r = await call(source, "report", { messageId: m.id });
    window.alert(r.ok ? "신고했어요. 확인 후 조치할게요." : (r.data?.error ?? "신고하지 못했어요."));
  };

  const toggleClosed = async () => {
    if (!data) return;
    const closing = !data.state.closed;
    if (closing && !window.confirm("대화를 닫을까요? 닫으면 양쪽 모두 더 쓸 수 없어요. 다시 열 수 있어요.")) return;
    const r = await call(source, closing ? "close" : "reopen");
    if (!r.ok) setError(r.data?.error ?? "바꾸지 못했어요.");
    await load();
  };

  const isHost = source.kind === "member" && data?.role === "host";
  const other = otherLabel ?? (isHost ? data?.guestLabel : data?.hostLabel) ?? "상대";

  return (
    <div className="mt-3 rounded-xl border border-charcoal-800/60 bg-charcoal-900/20">
      <div ref={listRef} className="max-h-80 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {!data && !error && <p className="text-xs text-charcoal-500">불러오는 중…</p>}
        {data && data.messages.length === 0 && (
          <p className="text-xs leading-relaxed text-charcoal-500">
            {isHost
              ? `${other}님과 이 예약에 대해 이야기할 수 있어요.`
              : "호스트에게 궁금한 점을 남길 수 있어요."}
          </p>
        )}
        {data?.messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">
              <div
                className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.mine ? "bg-navy-500 text-white" : "bg-charcoal-800/60 text-charcoal-100"
                }`}
              >
                {m.body}
              </div>
              <div className={`mt-0.5 flex gap-2 text-2xs text-charcoal-500 ${m.mine ? "justify-end" : ""}`}>
                <span>{timeLabel(m.createdAt)}</span>
                {!m.mine && (
                  <button type="button" onClick={() => report(m)} className="hover:text-charcoal-300">
                    신고
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="px-3 pb-2 text-xs text-red-500">{error}</p>}

      {data && data.state.canWrite ? (
        <div className="border-t border-charcoal-800/50 p-3">
          {data.suggestFirstNote && !text && (
            <button
              type="button"
              onClick={() => setText("만나서 반가워요. 장소는 ")}
              className="mb-2 rounded-full border border-navy-400/40 px-3 py-1 text-xs text-navy-600 hover:bg-navy-500/10 dark:text-navy-300"
            >
              장소·준비물을 알려 주세요
            </button>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
              }}
              rows={2}
              maxLength={2000}
              placeholder={`${other}님에게 메시지`}
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-charcoal-800/60 bg-transparent px-3 py-2 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-navy-400/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-navy-500 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-400 disabled:opacity-50"
            >
              {busy ? "보내는 중…" : "보내기"}
            </button>
          </div>
        </div>
      ) : data ? (
        <p className="border-t border-charcoal-800/50 px-3 py-2 text-xs text-charcoal-500">{data.state.reason}</p>
      ) : null}

      {isHost && data && (data.state.canWrite || data.state.closed) && (
        <div className="flex justify-end px-3 pb-2">
          <button type="button" onClick={toggleClosed} className="text-2xs text-charcoal-500 hover:text-charcoal-300">
            {data.state.closed ? "대화 다시 열기" : "대화 닫기"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── 예약 목록용: 안 읽음 수를 한 번 받아 두고 카드마다 '대화' 버튼에 붙인다 ── */

const UnreadContext = createContext<{ unread: Record<string, number>; clear: (id: string) => void }>({
  unread: {},
  clear: () => {},
});

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/bookings/chats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { unread: {} }))
      .then((d) => alive && setUnread(d.unread ?? {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const clear = useCallback((id: string) => setUnread((u) => ({ ...u, [id]: 0 })), []);
  return <UnreadContext.Provider value={{ unread, clear }}>{children}</UnreadContext.Provider>;
}

/** 예약 카드 아래 '대화' 줄 — 누르면 대화가 펼쳐진다. ?chat=<id>로 들어오면 처음부터 펼친다. */
export function BookingChatToggle({ bookingId, otherLabel }: { bookingId: string; otherLabel: string }) {
  const { unread, clear } = useContext(UnreadContext);
  const initiallyOpen = useSearchParams().get("chat") === bookingId;
  const [open, setOpen] = useState(!!initiallyOpen);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (initiallyOpen) ref.current?.scrollIntoView({ block: "center" });
  }, [initiallyOpen]);
  const n = unread[bookingId] ?? 0;
  return (
    <div ref={ref} className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-700 px-3 py-1 text-xs text-charcoal-300 hover:border-navy-400/60 hover:text-navy-400"
        aria-expanded={open}
      >
        대화
        {n > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 text-2xs font-semibold leading-4 text-white">{n}</span>
        )}
      </button>
      {open && <BookingChat source={{ kind: "member", bookingId }} otherLabel={otherLabel} onRead={() => clear(bookingId)} />}
    </div>
  );
}
