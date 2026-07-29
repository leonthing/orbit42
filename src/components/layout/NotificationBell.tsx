"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/lib/notifications-types";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "@/lib/notifications";
import { Avatar } from "@/components/Avatar";

function typeStyles(type: string): { bg: string; fg: string } {
  if (type.startsWith("booking")) return { bg: "bg-emerald-500/80", fg: "text-white" };
  if (type === "new_message") return { bg: "bg-sky-500/80", fg: "text-white" };
  if (type === "new_follower" || type === "invite_used")
    return { bg: "bg-navy-400/80", fg: "text-white" };
  if (type === "reaction") return { bg: "bg-pink-500/80", fg: "text-white" };
  if (type === "bid_placed") return { bg: "bg-amber-500/80", fg: "text-white" };
  if (type.startsWith("comment") || type.startsWith("reply"))
    return { bg: "bg-violet-500/80", fg: "text-white" };
  return { bg: "bg-charcoal-700", fg: "text-charcoal-200" };
}

function TypeIcon({ type, tiny }: { type: string; tiny?: boolean }) {
  const cls = tiny ? "h-2.5 w-2.5 text-white" : "h-4 w-4 text-white";
  if (type.startsWith("booking"))
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    );
  if (type === "new_message")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    );
  if (type === "new_follower" || type === "invite_used")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
      </svg>
    );
  if (type === "reaction")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
    );
  if (type === "bid_placed")
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
      </svg>
    );
  if (type.startsWith("comment") || type.startsWith("reply"))
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    );
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
  });
}

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [list, count] = await Promise.all([
        listNotifications(20),
        unreadNotificationCount(),
      ]);
      if (cancelled) return;
      setItems(list);
      setUnread(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Background refresh — the badge otherwise shows whatever value was
  // server-rendered and never updates when a new notification arrives.
  // Poll every 20s while the tab is visible, and refresh immediately
  // when the user switches back to the tab. (True push needs Supabase
  // Auth-backed realtime, which this custom-session app can't use yet.)
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const count = await unreadNotificationCount().catch(() => null);
      if (!cancelled && typeof count === "number") setUnread(count);
    };
    const interval = setInterval(refresh, 20_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    // Close on outside click.
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onMarkAll = async () => {
    await markAllNotificationsRead();
    setUnread(0);
    setItems((prev) =>
      prev ? prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) : prev,
    );
  };

  const onItemClick = async (n: AppNotification) => {
    if (!n.read_at) {
      await markNotificationRead(n.id);
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) =>
        prev
          ? prev.map((x) =>
              x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
            )
          : prev,
      );
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-charcoal-400 hover:bg-charcoal-800/50 hover:text-charcoal-100"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-navy-500 px-1 text-3xs font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[360px] max-w-[92vw] overflow-hidden rounded-xl border border-charcoal-800/60 bg-[rgb(var(--bg-surface))] shadow-2xl">
          <div className="flex items-center justify-between border-b border-charcoal-800/40 px-4 py-2.5">
            <p className="text-sm font-semibold text-charcoal-100">알림</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                className="text-2xs text-charcoal-500 hover:text-charcoal-200"
              >
                모두 읽음
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items === null ? (
              <p className="py-8 text-center text-xs text-charcoal-500">로딩…</p>
            ) : items.length === 0 ? (
              <p className="py-10 text-center text-xs text-charcoal-500">
                아직 알림이 없어요.
              </p>
            ) : (
              <ul className="divide-y divide-charcoal-800/40">
                {items.map((n) => {
                  const rowClass = `flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-charcoal-800/40 ${
                    !n.read_at ? "bg-navy-500/5" : ""
                  }`;
                  const inner = (
                    <>
                      <div className="relative shrink-0">
                        {n.actor ? (
                          <Avatar
                            url={n.actor.avatar_url}
                            name={n.actor.display_name || n.actor.username}
                            size={32}
                          />
                        ) : (
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              typeStyles(n.type).bg
                            }`}
                          >
                            <TypeIcon type={n.type} />
                          </span>
                        )}
                        {n.actor && (
                          <span
                            aria-hidden
                            className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[rgb(var(--bg-surface))] ${
                              typeStyles(n.type).bg
                            }`}
                          >
                            <TypeIcon type={n.type} tiny />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-charcoal-100">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-charcoal-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-2xs text-charcoal-600">
                          {relTime(n.created_at)}
                        </p>
                      </div>
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-navy-400" />
                      )}
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => onItemClick(n)}
                          className={rowClass}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onItemClick(n)}
                          className={rowClass}
                        >
                          {inner}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-charcoal-800/40 px-4 py-2 text-center">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-charcoal-400 hover:text-charcoal-100"
            >
              전체 보기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
