"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DmMessage } from "@/lib/dm";
import { DM_MAX_LEN } from "@/lib/dm-limits";
import { PendingButton } from "@/components/PendingButton";
import { useToast } from "@/components/Toast";
import { dmAction } from "../dm-client";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export function MessageThread({
  conversationId,
  initial,
  canWrite,
  reason,
  peerName,
}: {
  conversationId: string;
  initial: DmMessage[];
  canWrite: boolean;
  reason: string | null;
  peerName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState<DmMessage[]>(initial);
  const [text, setText] = useState("");
  // 터치 기기에는 Shift+Enter 안내가 의미 없고 칸을 넘친다 — 짧은 안내만
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // 5초마다 새 글 (열면 읽음 처리는 서버가 한다)
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const real = messages.filter((m) => !m.id.startsWith("tmp-"));
        const since = real.length ? real[real.length - 1].createdAt : "";
        const res = await fetch(`/api/v1/dm/${conversationId}?since=${encodeURIComponent(since)}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { messages: DmMessage[] };
        if (cancelled || !data.messages?.length) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
        });
      } catch {
        /* 다음 차례에 다시 */
      }
    };
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [conversationId, messages]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const tmp: DmMessage = { id: `tmp-${Date.now()}`, senderId: "me", mine: true, body, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, tmp]);
    setText("");
    try {
      const res = await fetch(`/api/v1/dm/${conversationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json()) as { message?: DmMessage; error?: string };
      if (!res.ok || !data.message) throw new Error(data.error || "보내지 못했어요.");
      setMessages((prev) => prev.map((m) => (m.id === tmp.id ? data.message! : m)));
      if (!canWrite || reason) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "보내지 못했어요.");
      setMessages((prev) => prev.filter((m) => m.id !== tmp.id));
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const act = async (action: string, confirmText: string, done: string, extra: Record<string, unknown> = {}) => {
    if (!window.confirm(confirmText)) return;
    setMenu(false);
    const r = await dmAction(conversationId, action, extra);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(done);
    if (action === "leave" || action === "block") {
      router.push("/messages");
      router.refresh();
    }
  };

  let lastDay = "";
  return (
    <>
      <div className="relative flex justify-end pt-2">
        <button type="button" onClick={() => setMenu((v) => !v)} className="rounded-lg px-2 py-1 text-xs text-charcoal-400 hover:text-charcoal-100" aria-label="대화 메뉴">
          ⋯ 메뉴
        </button>
        {menu && (
          <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] text-sm shadow-lg">
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-charcoal-800/40" onClick={() => act("leave", "대화에서 나갈까요? 지금까지의 글이 내 화면에서 사라져요.", "대화에서 나갔어요.")}>
              나가기
            </button>
            <button type="button" className="block w-full px-3 py-2 text-left text-red-400 hover:bg-charcoal-800/40" onClick={() => act("block", `${peerName}님을 차단할까요? 서로 대화할 수 없게 돼요.`, "차단했어요.")}>
              차단
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-charcoal-500">첫 메시지를 보내 보세요.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const day = formatDay(m.createdAt);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={m.id}>
                  {showDay && <div className="my-3 text-center text-2xs text-charcoal-500">{day}</div>}
                  <div className={`group flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <div className={`flex max-w-[85%] items-end gap-1.5 ${m.mine ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`min-w-0 whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${m.mine ? "bg-navy-500 text-white" : "bg-charcoal-800/60 text-charcoal-100"}`}>
                        {m.body}
                      </div>
                      <span className="shrink-0 whitespace-nowrap pb-1 text-2xs text-charcoal-500">{formatTime(m.createdAt)}</span>
                      {!m.mine && !m.id.startsWith("tmp-") && (
                        <button
                          type="button"
                          className="pb-1 text-2xs text-charcoal-600 opacity-0 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
                          onClick={() => act("report", "이 메시지를 신고할까요?", "신고했어요. 확인 후 조치할게요.", { messageId: m.id })}
                        >
                          신고
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {canWrite ? (
        <form onSubmit={onSubmit} className="border-t border-charcoal-800/40 bg-[rgb(var(--bg-base))] pt-3">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              maxLength={DM_MAX_LEN}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              placeholder={coarse ? "메시지 입력" : "메시지를 입력하세요… (Shift+Enter 줄바꿈)"}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:border-charcoal-600 focus:outline-none"
              style={{ maxHeight: 120 }}
            />
            <PendingButton type="submit" pending={sending} disabled={!text.trim()}>
              전송
            </PendingButton>
          </div>
        </form>
      ) : (
        <p className="border-t border-charcoal-800/40 pt-3 text-center text-xs text-charcoal-500">{reason ?? "지금은 보낼 수 없어요."}</p>
      )}
    </>
  );
}
