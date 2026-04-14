"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shareEventToFeed } from "@/lib/feed-posts";

export function ShareEventButton({
  eventId,
  eventTitle,
  eventStart,
}: {
  eventId: string;
  eventTitle: string;
  eventStart: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const defaultBody = (() => {
    const when = new Date(eventStart).toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${when} — ${eventTitle}`;
  })();

  const submit = () => {
    const text = (body.trim() || defaultBody).slice(0, 1000);
    startTransition(async () => {
      const res = await shareEventToFeed({ event_id: eventId, body: text });
      if (res.error) return alert(res.error);
      setOpen(false);
      setBody("");
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="피드에 공유"
        className="rounded p-0.5 text-charcoal-500 hover:bg-charcoal-700/50 hover:text-red-300"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] p-5 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">
              피드에 공유
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-charcoal-100">
              {eventTitle}
            </p>
            <p className="mt-0.5 text-xs text-charcoal-500">
              {new Date(eventStart).toLocaleString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder={`한 마디 남기기 (비우면 "${defaultBody}"로 공유)`}
              className="mt-3 w-full rounded-lg border border-charcoal-800/60 bg-charcoal-900/30 p-3 text-sm text-charcoal-100 placeholder:text-charcoal-500 focus:border-red-500/50 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-charcoal-700 px-4 py-2 text-sm text-charcoal-300 hover:border-charcoal-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-charcoal-950 hover:bg-red-400 disabled:opacity-60"
              >
                {pending ? "공유 중…" : "Share"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
