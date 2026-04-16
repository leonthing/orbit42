"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/lib/notifications-types";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { Avatar } from "@/components/Avatar";

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
      const list = await listNotifications(20);
      if (!cancelled) setItems(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

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
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
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
                className="text-[11px] text-charcoal-500 hover:text-charcoal-200"
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
                {items.map((n) => (
                  <li key={n.id}>
                    <Link
                      href={n.link ?? "#"}
                      onClick={() => onItemClick(n)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-charcoal-800/40 ${
                        !n.read_at ? "bg-red-600/5" : ""
                      }`}
                    >
                      {n.actor ? (
                        <Avatar
                          url={n.actor.avatar_url}
                          name={n.actor.display_name || n.actor.username}
                          size={32}
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600/15 text-red-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17.25v2.25a1.5 1.5 0 0 1-3 0v-2.25m3 0h-3m-9 0h18" />
                          </svg>
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-charcoal-100">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-charcoal-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-charcoal-600">
                          {relTime(n.created_at)}
                        </p>
                      </div>
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                    </Link>
                  </li>
                ))}
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
