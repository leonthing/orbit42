"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/lib/messages-types";
import { sendMessage, markRead } from "@/lib/messages";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function MessageThread({
  conversationId,
  me,
  initial,
}: {
  conversationId: string;
  me: string;
  initial: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Poll for new messages every 5s.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const since = messages.length
          ? messages[messages.length - 1].created_at
          : "";
        const res = await fetch(
          `/api/messages/${conversationId}?since=${encodeURIComponent(since)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages: Message[] };
        if (cancelled || !data.messages?.length) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const next = [...prev];
          for (const m of data.messages) if (!seen.has(m.id)) next.push(m);
          return next;
        });
        // If new messages arrived from the other side, mark as read.
        if (data.messages.some((m) => m.sender_id !== me)) {
          markRead(conversationId);
        }
      } catch {
        /* noop */
      }
    };
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [conversationId, messages, me]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sender_id: me,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    const res = await sendMessage(conversationId, body);
    setSending(false);
    if ("error" in res && res.error) {
      setError(res.error);
      // Roll back optimistic message.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(body);
    }
  };

  let lastDay = "";
  return (
    <>
      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-charcoal-500">
            첫 메시지를 보내보세요.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const day = formatDay(m.created_at);
              const showDay = day !== lastDay;
              lastDay = day;
              const mine = m.sender_id === me;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-3 text-center text-[11px] text-charcoal-500">
                      {day}
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`flex max-w-[75%] items-end gap-1.5 ${
                        mine ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                          mine
                            ? "bg-red-600 text-white"
                            : "bg-charcoal-800/60 text-charcoal-100"
                        }`}
                      >
                        {m.body}
                      </div>
                      <span className="pb-1 text-[10px] text-charcoal-500">
                        {formatTime(m.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-charcoal-800/40 bg-[rgb(var(--bg-base))] pt-3"
      >
        {error && (
          <p className="mb-2 text-xs text-red-400">{error}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            placeholder="메시지를 입력하세요… (Shift+Enter 줄바꿈)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm text-charcoal-100 placeholder-charcoal-600 focus:border-charcoal-600 focus:outline-none"
            style={{ maxHeight: 120 }}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </form>
    </>
  );
}
